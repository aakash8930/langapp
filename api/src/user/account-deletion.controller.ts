import { Controller, Delete, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountDeletionService } from './account-deletion.service';

/**
 * Handles the DELETE /me endpoint for permanent account deletion.
 *
 * This controller lives in AccountDeletionModule rather than UserModule because
 * AccountDeletionService orchestrates cross-module cascades and cannot be
 * provided by UserModule without creating circular import chains (UserModule is
 * imported by every module that AccountDeletionService depends on).
 *
 * The endpoint is at the same `/me` path as the rest of the user endpoints —
 * NestJS merges controllers that share a base path, so the learner-facing API
 * sees a unified `/me` prefix across both controllers.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  /**
   * Permanently delete the authenticated account and all associated data.
   *
   * **This operation is irreversible.** All learning progress, SRS cards,
   * lesson completions, chat history, social data, and analytics events are
   * erased. Reports filed by or about the account are retained for moderation
   * purposes (they cannot be used to identify the account — they are evidence
   * for safety review, not a profile).
   *
   * Returns `204 No Content` on success. The client should invalidate any stored
   * tokens and navigate to the sign-up screen; subsequent requests with the old
   * token will return `404` since the user document is gone.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() current: AuthenticatedUser): Promise<void> {
    await this.accountDeletion.deleteAccount(current.userId);
  }
}
