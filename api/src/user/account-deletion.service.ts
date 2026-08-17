import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { ChatService } from '../chat/chat.service';
import { LearningService } from '../learning/learning.service';
import { SocialService } from '../social/social.service';
import { PracticeService } from '../practice/practice.service';
import { UserService } from './user.service';

/**
 * Orchestrates GDPR-style account deletion (OPEN-ITEMS #5/#32).
 *
 * ## Why this class exists
 *
 * Each module owns its own collections (the §4 rule). `UserService` cannot call
 * `LearningService.deleteAllForUser` without importing `LearningModule`, which
 * would create a circular dependency chain. Putting the orchestration here, in a
 * separate service that is provided from a higher-level module (the app module or
 * a dedicated one), keeps the direction of every dependency edge the same and
 * leaves each owning service testable in isolation.
 *
 * ## What is deleted
 *
 * - `users` — the account document itself (owned by UserService)
 * - `lessonCompletions`, `exerciseAttempts`, learner state, checkpoints — owned by LearningService
 * - `chatSessions`, `chatMessages` — owned by ChatService
 * - `events` (analytics) — owned by AnalyticsService
 * - `friendships`, `blocks`, `directMessages` — owned by SocialService
 * - `practiceSessions` — owned by PracticeService
 *
 * ## What is NOT deleted
 *
 * - `reports` — kept for moderation integrity (see SocialService.deleteAllForUser)
 * - `leagueStandings` — ephemeral weekly snapshots; they expire after the week ends
 *
 * ## Ordering
 *
 * The cross-module deletes run in parallel first, then the user document is
 * removed last. This order matters: if the user doc were removed first and the
 * process crashed mid-cascade, there would be orphan data with no owning user.
 * The reverse leaves consistent data — a completed cascade followed by a user
 * removal. Idempotent re-runs are safe because `deleteMany` on an already-empty
 * set is a no-op.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly userService: UserService,
    private readonly learningService: LearningService,
    private readonly chatService: ChatService,
    private readonly analyticsService: AnalyticsService,
    private readonly socialService: SocialService,
    private readonly practiceService: PracticeService,
  ) {}

  /**
   * Permanently delete an account and all associated data.
   *
   * Throws `NotFoundException` when the user does not exist, so the controller
   * can return a 404 rather than silently accepting a deletion that did nothing.
   */
  async deleteAccount(userId: string): Promise<void> {
    // Verify the account exists before doing anything irreversible. The DELETE
    // token is valid (JwtAuthGuard passed), but the user could have already been
    // deleted by a concurrent call or an admin action.
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cross-module cascade in parallel — each deleteAllForUser is idempotent.
    await Promise.all([
      this.learningService.deleteAllForUser(userId).catch((err: unknown) => {
        this.logger.error(
          `Learning data deletion failed for user ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }),
      this.chatService.deleteAllForUser(userId).catch((err: unknown) => {
        this.logger.error(
          `Chat data deletion failed for user ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }),
      this.analyticsService.deleteAllForUser(userId).catch((err: unknown) => {
        this.logger.error(
          `Analytics data deletion failed for user ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }),
      this.socialService.deleteAllForUser(userId).catch((err: unknown) => {
        this.logger.error(
          `Social data deletion failed for user ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }),
      this.practiceService.deleteAllForUser(userId).catch((err: unknown) => {
        this.logger.error(
          `Practice data deletion failed for user ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }),
    ]);

    // User document is last — see the ordering note in the class docstring.
    await this.userService.deleteUser(userId);

    this.logger.log(`Account ${userId} deleted and all associated data erased.`);
  }
}
