import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
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

    const [cardsDueNow, lessonsCompleted] = await Promise.all([
      this.reviewService.countDue(current.userId, now),
      this.learningService.countCompletedLessons(current.userId),
    ]);

    const { xp, streakDays, lastStudyDate, dailyGoalXp } = user.gamification;
    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(xp);

    // Not user.gamification.todayXp directly — the stored counter still holds
    // yesterday's total until the next award rewrites it, so the read path has
    // to notice the local day has turned. UserService owns that rule.
    const xpToday = this.userService.todayXpFor(user, now);

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
      },
      cardsDueNow,
      lessonsCompleted,
    };
  }
}
