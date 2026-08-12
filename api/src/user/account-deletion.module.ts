import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ChatModule } from '../chat/chat.module';
import { LearningModule } from '../learning/learning.module';
import { SocialModule } from '../social/social.module';
import { PracticeModule } from '../practice/practice.module';
import { UserModule } from '../user/user.module';
import { AccountDeletionController } from '../user/account-deletion.controller';
import { AccountDeletionService } from '../user/account-deletion.service';

/**
 * Provides the cross-module account-deletion cascade (OPEN-ITEMS #5/#32).
 *
 * ## Why a separate module
 *
 * `AccountDeletionService` orchestrates deletes across LearningModule,
 * ChatModule, AnalyticsModule and SocialModule — all of which already import
 * UserModule. If the service lived inside UserModule, the import graph would
 * become cyclic.
 *
 * Extracting it into a dedicated module at the app level keeps every edge
 * one-directional: this module imports all the owning modules and composes
 * them, while none of them need to know about this module.
 *
 * The controller handles `DELETE /me` at the same path prefix as `UserController`,
 * which NestJS merges automatically — the learner-facing API sees a unified
 * `/me` prefix across both controllers.
 */
@Module({
  imports: [UserModule, LearningModule, ChatModule, AnalyticsModule, SocialModule, PracticeModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
