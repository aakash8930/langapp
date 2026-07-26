import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { levelFromXp } from '../user/gamification/level';
import { UserService } from '../user/user.service';
import { ProgressResponse } from './dto/progress-response.dto';
import { LearningService } from './learning.service';
import { ReviewService } from './review.service';

/**
 * Lives in the learning module rather than next to the other /me routes, and
 * that placement is the point: /me/progress needs both the user's gamification
 * block and the learner's card/lesson counts. UserModule importing
 * LearningModule would close a cycle — learning already imports user — and the
 * fix for that would be forwardRef, which trades a compile-time error for a
 * runtime ordering bug. Learning depends on user in one direction only, so the
 * route sits on this side of the arrow and reads user state through
 * UserService, never the users collection (§4).
 */
@Controller('me/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(
    private readonly userService: UserService,
    private readonly learningService: LearningService,
    private readonly reviewService: ReviewService,
    // Read side of `events`, for the daily summary (T1.8). Learning already
    // depends on analytics for the write side, so this adds no new module edge.
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get()
  async progress(@CurrentUser() current: AuthenticatedUser): Promise<ProgressResponse> {
    const user = await this.userService.findById(current.userId);
    if (!user) {
      // Token verified but the account is gone — same shape as GET /me.
      throw new NotFoundException('User not found');
    }

    // One `now` for the whole response: today's-XP rollover and the due cutoff
    // must agree, and two calls to new Date() can straddle a midnight boundary.
    const now = new Date();

    const [cardsDueNow, completedLessonIds, todayCounts] = await Promise.all([
      this.reviewService.countDue(current.userId, now),
      this.learningService.findCompletedLessonIds(current.userId),
      // Counted on the user's own local day, the same `now` and the same tz rule
      // `todayXpFor` uses below — so the whole `daily` block agrees about when
      // today started rather than two clocks straddling a midnight.
      this.analyticsService.countTodayByType(
        current.userId,
        ['review.graded', 'lesson.completed'],
        user.settings.tz,
        now,
      ),
    ]);

    const { xp, streakDays, lastStudyDate, dailyGoalXp } = user.gamification;
    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(xp);

    // Not user.gamification.todayXp directly — the stored counter still holds
    // yesterday's total until the next award rewrites it, so the read path has
    // to notice the local day has turned. UserService owns that rule.
    const xpToday = this.userService.todayXpFor(user, now);

    // Same `now` again: a heart that regenerated between two clock reads would
    // make `nextHeartAt` disagree with `current`.
    const heartState = this.userService.heartsFor(user, now);

    return {
      xp,
      level,
      xpIntoLevel,
      xpForNextLevel,
      streakDays,
      lastStudyDate,
      daily: {
        xpToday,
        goalXp: dailyGoalXp,
        // Guarded against a zero goal, which the schema permits (min: 0) and
        // which would otherwise make this NaN.
        percentOfGoal:
          dailyGoalXp > 0 ? Math.min(100, Math.round((xpToday / dailyGoalXp) * 100)) : 100,
        goalMet: xpToday >= dailyGoalXp,
        reviewsDone: todayCounts['review.graded'] ?? 0,
        lessonsDone: todayCounts['lesson.completed'] ?? 0,
      },
      hearts: {
        current: heartState.hearts,
        max: heartState.maxHearts,
        nextHeartAt: heartState.nextHeartAt ? heartState.nextHeartAt.toISOString() : null,
      },
      gems: heartState.gems,
      cardsDueNow,
      lessonsCompleted: completedLessonIds.length,
      completedLessonIds,
    };
  }
}
