import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { CheckRemindersPayload, JOB_CHECK_REMINDERS, QUEUE_NOTIFICATIONS } from '../jobs/queues';
import { User, UserDocument } from '../user/schemas/user.schema';
import { localDateString } from '../user/gamification/streak';
import { NotificationService } from './notification.service';

const PREFERRED_TIME_MAP: Record<string, number> = {
  morning: 8,
  afternoon: 14,
  evening: 19,
  night: 21,
};

@Processor(QUEUE_NOTIFICATIONS)
@Injectable()
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job<CheckRemindersPayload>): Promise<void> {
    if (job.name !== JOB_CHECK_REMINDERS) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const now = job.data.now ? new Date(job.data.now) : new Date();

    // Find users who have study reminders enabled
    const users = await this.userModel
      .find({ 'notificationSettings.studyReminders': true })
      .exec();

    let created = 0;
    for (const user of users) {
      try {
        const createdCount = await this.checkUser(user, now);
        created += createdCount;
      } catch (err) {
        this.logger.warn(`Reminder check failed for user ${user._id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (created > 0) {
      this.logger.log(`Created ${created} reminder notifications`);
    }
  }

  private async checkUser(user: UserDocument, now: Date): Promise<number> {
    const tz = user.settings.tz;
    const today = localDateString(now, tz);
    const localHour = this.localHour(now, tz);

    // Already studied today — no reminder needed
    if (user.gamification.lastStudyDate === today) return 0;

    const preferredTime = user.onboardingState?.preferredStudyTime?.toLowerCase() ?? '';
    const reminderHour = PREFERRED_TIME_MAP[preferredTime] ?? 19;

    // Only fire if the local hour matches the preferred reminder window
    if (localHour !== reminderHour) return 0;

    const userId = user._id.toString();
    let created = 0;

    // Streak at risk: studied yesterday but not yet today
    const yesterday = localDateString(new Date(now.getTime() - 86400000), tz);
    if (user.gamification.streakDays > 0 && user.gamification.lastStudyDate === yesterday) {
      await this.notifications.create({
        userId,
        type: 'reminder',
        title: 'Streak at Risk!',
        body: `Your ${user.gamification.streakDays}-day streak is at risk. Study today to keep the flame alive!`,
        metadata: { streakDays: user.gamification.streakDays },
      });
      created++;
    }

    // Daily goal not yet met and it's past noon
    if (localHour >= 18 && user.gamification.todayXp < user.gamification.dailyGoalXp) {
      // Read todayXp through the same tz-corrected path as the controller
      const effectiveTodayXp = user.gamification.lastStudyDate === today ? user.gamification.todayXp : 0;
      if (effectiveTodayXp < user.gamification.dailyGoalXp) {
        await this.notifications.create({
          userId,
          type: 'reminder',
          title: "Don't Forget Your Goal!",
          body: `You're at ${effectiveTodayXp}/${user.gamification.dailyGoalXp} XP. There's still time to hit your daily goal!`,
          metadata: { xpToday: effectiveTodayXp, goalXp: user.gamification.dailyGoalXp },
        });
        created++;
      }
    }

    return created;
  }

  private localHour(date: Date, tz: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(date);
      const hourPart = parts.find((p) => p.type === 'hour');
      return hourPart ? parseInt(hourPart.value, 10) : 0;
    } catch {
      return 0;
    }
  }
}
