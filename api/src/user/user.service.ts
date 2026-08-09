import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationService } from '../notification/notification.service';
import { levelFromXp } from './gamification/level';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { localDateString, nextStreak } from './gamification/streak';
import { isoWeek } from './gamification/week';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  dateOfBirth?: Date;
  nativeLanguage?: string;
  tz?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationService,
  ) {}

  /** Returns null when the email is already taken, so callers decide the error shape. */
  async create(input: CreateUserInput): Promise<UserDocument | null> {
    try {
      return await this.userModel.create({
        email: input.email,
        passwordHash: input.passwordHash,
        profile: {
          displayName: input.displayName,
          nativeLanguage: input.nativeLanguage ?? 'en',
          activeTrack: 'ja',
          // Null for accounts created before the age gate existed. Absent means
          // "unknown age", which every age check treats as a refusal.
          dateOfBirth: input.dateOfBirth ?? null,
        },
        settings: input.tz ? { tz: input.tz } : {},
      });
    } catch (err) {
      // 11000 = duplicate key on the unique email index. Racing registrations
      // land here even when the pre-check passed, so it must be handled.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        return null;
      }
      throw err;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Everyone competing in one league tier.
   *
   * Unpaginated on purpose at this scale — a tier holds tens of people, and the
   * leaderboard shows all of them. This is the read that will need sharding
   * first if the user base ever grows: Duolingo splits a tier into cohorts of
   * about 30, and that is the concept to add here rather than a `limit`.
   */
  async findByLeagueTier(tier: number): Promise<UserDocument[]> {
    // A schema default is applied on *write*, so every account created before
    // `leagueTier` existed has no such field and matches `{ leagueTier: 0 }`
    // nowhere. Without this the entire pre-league user base would be invisible
    // to the leaderboard forever — caught on the live API, where Bronze showed
    // one player out of 33.
    //
    // Treating absent as Bronze in the query rather than backfilling once keeps
    // it correct after a restore from an old backup too, which a migration would
    // not.
    const filter =
      tier === 0
        ? {
            $or: [
              { 'gamification.leagueTier': 0 },
              { 'gamification.leagueTier': { $exists: false } },
            ],
          }
        : { 'gamification.leagueTier': tier };

    return this.userModel.find(filter).exec();
  }

  /** Move a learner between tiers when a week settles. */
  async setLeagueTier(id: string, tier: number): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $set: { 'gamification.leagueTier': tier } })
      .exec();
  }

  /** Bulk lookup for the social module's friend and block lists. */
  async findManyByIds(ids: string[]): Promise<UserDocument[]> {
    const valid = ids.filter((id) => Types.ObjectId.isValid(id));
    if (valid.length === 0) {
      return [];
    }
    return this.userModel.find({ _id: { $in: valid.map((id) => new Types.ObjectId(id)) } }).exec();
  }

  /**
   * Find learners by display name, for the friend search.
   *
   * **Display name only, never email.** Searching by address would make this an
   * oracle for "does this email have an account" — precisely the enumeration
   * `login` burns a dummy argon2 verify to prevent.
   *
   * The query is escaped before it becomes a regex: an unescaped `.*` would
   * match every user, and a pathological pattern is a cheap CPU attack. Anchored
   * with `^` so it is a prefix search, which is both what someone typing a name
   * expects and index-friendly.
   */
  async searchByDisplayName(
    query: string,
    excludeIds: string[],
    limit: number,
  ): Promise<UserDocument[]> {
    const pattern = new RegExp(`^${escapeRegex(query)}`, 'i');
    const excluded = excludeIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    return this.userModel
      .find({ 'profile.displayName': pattern, _id: { $nin: excluded } })
      .limit(limit)
      .exec();
  }

  /**
   * The only shape another learner may see of a user.
   *
   * An allowlist for the same reason `toUserResponse` is one, but a much shorter
   * one: this is shown to *strangers*, so it carries no email, no settings, no
   * date of birth and no lesson history — a display name and the public-facing
   * numbers that make a leaderboard meaningful, and nothing else.
   */
  toPublicProfile(user: UserDocument): {
    id: string;
    displayName: string;
    level: number;
    xp: number;
    streakDays: number;
  } {
    return {
      id: user._id.toString(),
      displayName: user.profile.displayName,
      level: levelFromXp(user.gamification.xp).level,
      xp: user.gamification.xp,
      streakDays: user.gamification.streakDays,
    };
  }

  /**
   * The one path that loads the hash. Only the auth module calls it, and only
   * to verify a password — the document must never reach a response body.
   */
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  /**
   * Updates only the password hash. Used by the password-reset flow.
   * The caller is responsible for hashing the new password with argon2.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { passwordHash } },
    );
  }

  /** Sets the TOTP secret on the user. Pass null to clear it. */
  async updateTotpSecret(userId: string, secret: string | null): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { totpSecret: secret } },
    );
  }

  /** Enables TOTP on the user's account. */
  async enableTotp(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { totpEnabled: true } },
    );
  }

  /** Disables TOTP — clears both the flag and the secret. */
  async disableTotp(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { totpEnabled: false, totpSecret: null } },
    );
  }

  /** Sets an email verification token on a user. */
  async setVerificationToken(userId: string, token: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { emailVerificationToken: token } },
    );
  }

  /** Marks the email as verified and clears the token. */
  async verifyEmail(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { emailVerified: true, emailVerificationToken: null } },
    );
  }

  /** Reads the verification token for a user. */
  async getVerificationToken(userId: string): Promise<string | null> {
    const user = await this.userModel.findById(userId)
      .select('+emailVerificationToken')
      .exec();
    return user?.emailVerificationToken ?? null;
  }

  /** Reads the TOTP secret for verification. */
  async getTotpSecret(userId: string): Promise<string | null> {
    const user = await this.userModel.findById(userId)
      .select('+totpSecret')
      .exec();
    return user?.totpSecret ?? null;
  }

  /**
   * The only way another module may change a user's XP — the learning module
   * calls this rather than reaching into `users` itself.
   *
   * This is also where the streak advances, because "the first XP-earning
   * action of a new day" is precisely this call. Keeping both here means a
   * future XP source (chat, a new exercise type) gets streak handling for free
   * instead of having to remember to ask for it.
   */
  async awardXp(id: string, amount: number, now: Date = new Date()): Promise<UserDocument> {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new BadRequestException(`XP award must be a non-negative integer, got ${amount}`);
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const today = localDateString(now, user.settings.tz);
    const previousStudyDate = user.gamification.lastStudyDate;
    const outcome = nextStreak(user.gamification.streakDays, previousStudyDate, today);

    // The weekly counter rolls on a *different* boundary from the daily one —
    // UTC weeks against local days — so it is checked separately. A UTC week can
    // turn without the learner's local day turning, and vice versa.
    const week = isoWeek(now);
    const resetWeek = user.gamification.weeklyXpWeek !== week;

    if (!outcome.isNewDay) {
      // Same local day: pure accumulation, no streak concerns — but the week may
      // still have rolled underneath it.
      return this.incrementXp(id, amount, { resetToday: false, resetWeek, week });
    }

    // A new local day. Guard on lastStudyDate still holding the value we read,
    // so two concurrent first-actions-of-the-day can't both roll the streak.
    const rolled = await this.userModel
      .findOneAndUpdate(
        { _id: id, 'gamification.lastStudyDate': previousStudyDate },
        {
          // Built rather than spread: an `...(cond ? {$inc: …} : {})` after a
          // literal `$inc` *replaces* it, which silently dropped lifetime XP on
          // every day-roll. A test caught it; the shape below cannot do that.
          $inc: {
            'gamification.xp': amount,
            ...(resetWeek ? {} : { 'gamification.weeklyXp': amount }),
          },
          $set: {
            'gamification.streakDays': outcome.streakDays,
            'gamification.lastStudyDate': today,
            // The day rolled over, so today's counter starts from this award.
            'gamification.todayXp': amount,
            'gamification.weeklyXpWeek': week,
            ...(resetWeek ? { 'gamification.weeklyXp': amount } : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (rolled) {
      await this.fireAchievementNotifications(rolled);
      return rolled;
    }

    // Lost the race: another request already rolled the day. The streak and
    // date are correct as they stand, so only this award still needs applying —
    // and the winner already rolled the week too, so this must not reset it.
    const updated = await this.incrementXp(id, amount, { resetToday: false, resetWeek: false, week });
    await this.fireAchievementNotifications(updated);
    return updated;
  }

  private async incrementXp(
    id: string,
    amount: number,
    opts: { resetToday: boolean; resetWeek: boolean; week: string },
  ): Promise<UserDocument> {
    // `$inc` so concurrent awards accumulate instead of overwriting each other;
    // a read-modify-write here would silently lose XP. A counter whose period
    // just rolled is `$set` to this award instead — incrementing would carry
    // last period's total forward.
    const inc: Record<string, number> = { 'gamification.xp': amount };
    const set: Record<string, unknown> = { 'gamification.weeklyXpWeek': opts.week };

    if (opts.resetToday) set['gamification.todayXp'] = amount;
    else inc['gamification.todayXp'] = amount;

    if (opts.resetWeek) set['gamification.weeklyXp'] = amount;
    else inc['gamification.weeklyXp'] = amount;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $inc: inc, $set: set }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Today's XP as it should be *read*, which isn't always what's stored: if the
   * user hasn't earned anything yet today, the persisted counter still holds
   * yesterday's total. Nothing rewrites it until the next award, so the read
   * path has to notice the day has turned.
   */
  todayXpFor(user: UserDocument, now: Date = new Date()): number {
    const today = localDateString(now, user.settings.tz);
    return user.gamification.lastStudyDate === today ? user.gamification.todayXp : 0;
  }

  /**
   * This week's XP as it should be *read* — same correction as `todayXpFor`, on
   * the UTC week boundary instead of the learner's local day.
   *
   * Without it, the first leaderboard read after a Monday would rank everyone by
   * last week's totals, because nothing rewrites a user's row until their next
   * award. Reading `gamification.weeklyXp` directly is a bug.
   */
  weeklyXpFor(user: UserDocument, now: Date = new Date()): number {
    return user.gamification.weeklyXpWeek === isoWeek(now) ? user.gamification.weeklyXp : 0;
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<UserDocument> {
    if (dto.tz !== undefined && !isValidTimeZone(dto.tz)) {
      throw new BadRequestException(`Unknown time zone: ${dto.tz}`);
    }

    // Dotted paths so a partial update never clobbers the sibling settings.
    const patch: Record<string, unknown> = {};
    if (dto.audioSpeed !== undefined) patch['settings.audioSpeed'] = dto.audioSpeed;
    if (dto.theme !== undefined) patch['settings.theme'] = dto.theme;
    if (dto.tz !== undefined) patch['settings.tz'] = dto.tz;
    if (dto.leaderboardOptIn !== undefined) {
      patch['settings.leaderboardOptIn'] = dto.leaderboardOptIn;
    }
    if (dto.fontSize !== undefined) patch['settings.fontSize'] = dto.fontSize;
    // The one field on this DTO that does not live under `settings` — the daily
    // goal is what /me/progress measures the day against, so it sits with the
    // rest of the gamification state it is compared to.
    if (dto.dailyGoalXp !== undefined) patch['gamification.dailyGoalXp'] = dto.dailyGoalXp;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateOnboarding(
    id: string,
    dto: { step?: number; nativeLanguage?: string; proficiencyLevel?: string; learningGoals?: string[]; learningStyle?: string; preferredStudyTime?: string; notificationsEnabled?: boolean; studyTimeMinutes?: number; dailyGoalXp?: number; onboardingComplete?: boolean },
  ): Promise<UserDocument> {
    const patch: Record<string, unknown> = {};
    if (dto.step !== undefined) patch['onboardingState.onboardingStep'] = dto.step;
    if (dto.nativeLanguage !== undefined) patch['profile.nativeLanguage'] = dto.nativeLanguage;
    if (dto.proficiencyLevel !== undefined) patch['onboardingState.proficiencyLevel'] = dto.proficiencyLevel;
    if (dto.learningGoals !== undefined) patch['onboardingState.learningGoals'] = dto.learningGoals;
    if (dto.learningStyle !== undefined) patch['onboardingState.learningStyle'] = dto.learningStyle;
    if (dto.preferredStudyTime !== undefined) patch['onboardingState.preferredStudyTime'] = dto.preferredStudyTime;
    if (dto.notificationsEnabled !== undefined) patch['onboardingState.notificationsEnabled'] = dto.notificationsEnabled;
    if (dto.studyTimeMinutes !== undefined) patch['onboardingState.studyTimeMinutes'] = dto.studyTimeMinutes;
    if (dto.dailyGoalXp !== undefined) patch['gamification.dailyGoalXp'] = dto.dailyGoalXp;
    if (dto.onboardingComplete !== undefined) patch['onboardingState.onboardingComplete'] = dto.onboardingComplete;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateNotificationSettings(
    id: string,
    dto: {
      studyReminders?: boolean; achievements?: boolean; community?: boolean;
      eventsUpdates?: boolean; marketing?: boolean;
      emailDailyGoal?: boolean; emailWeeklyDigest?: boolean; emailMarketing?: boolean;
    },
  ): Promise<UserDocument> {
    const patch: Record<string, unknown> = {};
    if (dto.studyReminders !== undefined) patch['notificationSettings.studyReminders'] = dto.studyReminders;
    if (dto.achievements !== undefined) patch['notificationSettings.achievements'] = dto.achievements;
    if (dto.community !== undefined) patch['notificationSettings.community'] = dto.community;
    if (dto.eventsUpdates !== undefined) patch['notificationSettings.eventsUpdates'] = dto.eventsUpdates;
    if (dto.marketing !== undefined) patch['notificationSettings.marketing'] = dto.marketing;
    if (dto.emailDailyGoal !== undefined) patch['notificationSettings.emailDailyGoal'] = dto.emailDailyGoal;
    if (dto.emailWeeklyDigest !== undefined) patch['notificationSettings.emailWeeklyDigest'] = dto.emailWeeklyDigest;
    if (dto.emailMarketing !== undefined) patch['notificationSettings.emailMarketing'] = dto.emailMarketing;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    dto: { displayName?: string; bio?: string; nativeLanguage?: string },
  ): Promise<UserDocument> {
    const patch: Record<string, unknown> = {};
    if (dto.displayName !== undefined) patch['profile.displayName'] = dto.displayName;
    if (dto.bio !== undefined) patch['profile.bio'] = dto.bio;
    if (dto.nativeLanguage !== undefined) patch['profile.nativeLanguage'] = dto.nativeLanguage;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Phase 0 — Data foundation. Idempotently append kana characters to
   * `learningState.knownKana`.
   *
   * Uses Mongo's `$addToSet` because the reader (`/vocab/by-known-kana`,
   * Phase 1 #5 filter) treats the field as a *set*: a character taught
   * twice should appear once. `$addToSet` enforces that without a
   * read-then-write race that would lose concurrent additions.
   *
   * Called from `LearningService.completeLesson` on first completion only —
   * re-completing a lesson teaches no new kana. Calling this with an empty
   * array is a no-op (Mongo silently skips the operator); calling with an
   * array of already-present characters is a no-op too.
   *
   * Returns the *updated* user so callers do not have to re-fetch — useful
   * when the next thing they do is read back the resulting `knownKana`
   * (e.g. a test, or a future "you learned N new kana" toast).
   */
  async addKnownKana(userId: string, characters: readonly string[]): Promise<UserDocument> {
    if (characters.length === 0) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { 'learningState.knownKana': { $each: [...characters] } } },
        { new: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Permanently remove the user document.
   *
   * Called **only** by AccountDeletionService, after all cross-module data has
   * been erased. Never call this directly from a controller — use the deletion
   * service so the cascade runs first.
   */
  async deleteUser(id: string): Promise<void> {
    await this.userModel.deleteOne({ _id: id }).exec();
  }

  async exportUserData(id: string): Promise<Record<string, unknown>> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        displayName: user.profile.displayName,
        bio: user.profile.bio ?? '',
        nativeLanguage: user.profile.nativeLanguage,
        activeTrack: user.profile.activeTrack,
      },
      email: user.email,
      createdAt: user.get('createdAt'),
      gamification: {
        xp: user.gamification.xp,
        streakDays: user.gamification.streakDays,
        dailyGoalXp: user.gamification.dailyGoalXp,
        leagueTier: user.gamification.leagueTier,
      },
      settings: {
        audioSpeed: user.settings.audioSpeed,
        theme: user.settings.theme,
        tz: user.settings.tz,
        fontSize: user.settings.fontSize,
        leaderboardOptIn: user.settings.leaderboardOptIn,
      },
      notificationSettings: user.notificationSettings,
      subscription: user.subscription,
      onboardingState: user.onboardingState,
      learningState: user.learningState,
    };
  }

  private async fireAchievementNotifications(user: UserDocument): Promise<void> {
    const userId = user._id.toString();
    const notifSettings = user.notificationSettings;
    const streakDays = user.gamification.streakDays;

    // Streak milestones
    if (notifSettings?.achievements !== false) {
      const STREAK_MILESTONES = [3, 7, 30];
      for (const milestone of STREAK_MILESTONES) {
        if (streakDays === milestone) {
          await this.notifications.create({
            userId,
            type: 'achievement',
            title: `${milestone}-Day Streak!`,
            body: `You've studied for ${milestone} days in a row. Keep the flame alive!`,
            metadata: { streakDays: milestone },
          });
        }
      }

      // Level up at tier boundaries
      const level = levelFromXp(user.gamification.xp).level;
      const TIER_BOUNDARIES = [5, 11, 21, 36];
      if (TIER_BOUNDARIES.includes(level)) {
        let tierName = 'Bronze';
        if (level >= 36) tierName = 'Master';
        else if (level >= 21) tierName = 'Diamond';
        else if (level >= 11) tierName = 'Gold';
        else if (level >= 5) tierName = 'Silver';

        await this.notifications.create({
          userId,
          type: 'achievement',
          title: 'New League Tier!',
          body: `Congratulations! You've reached the ${tierName} tier at level ${level}.`,
          metadata: { level, tier: tierName },
        });
      }
    }

    // Daily goal met
    const todayXp = this.todayXpFor(user);
    const goalXp = user.gamification.dailyGoalXp;
    if (todayXp >= goalXp && goalXp > 0 && user.gamification.lastStudyDate === localDateString(new Date(), user.settings.tz)) {
      await this.notifications.create({
        userId,
        type: 'goal',
        title: 'Daily Goal Completed!',
        body: `Great work! You earned ${todayXp} XP today and hit your ${goalXp} XP goal.`,
        metadata: { xpToday: todayXp, goalXp },
      });
    }
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape a user-supplied string for use inside a RegExp.
 *
 * Without this, a search for `.*` matches every account and a nested quantifier
 * is a cheap way to burn CPU on the database. Both are reachable from an
 * unauthenticated-looking text box.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
