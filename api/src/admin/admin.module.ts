import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminGuard } from './admin.guard';
import { AuditService } from './audit.service';
import { AdminDashboardController } from './controllers/dashboard.controller';
import { AdminUsersController } from './controllers/users.controller';
import { AdminContentController } from './controllers/content.controller';
import { AdminReportsController } from './controllers/reports.controller';
import { AdminNotificationsController } from './controllers/notifications.controller';
import { AdminSettingsController } from './controllers/settings.controller';
import { AdminMailController } from './controllers/mail.controller';
import { AdminAction, AdminActionSchema } from './schemas/admin-action.schema';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { AppSetting, AppSettingSchema } from './schemas/app-setting.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Event, EventSchema } from '../analytics/schemas/event.schema';
import { ContentReport, ContentReportSchema } from '../content/schemas/content-report.schema';
import { Report, ReportSchema } from '../social/schemas/report.schema';
import { NotificationModule } from '../notification/notification.module';
import { Notification, NotificationSchema } from '../notification/schemas/notification.schema';
import { ContentModule } from '../content/content.module';
import { Course, CourseSchema } from '../content/schemas/course.schema';
import { Quiz, QuizSchema } from '../content/schemas/quiz.schema';
import { ContentVersion, ContentVersionSchema } from '../content/schemas/content-version.schema';
import { Lesson, LessonSchema } from '../content/schemas/lesson.schema';
import { VocabItem, VocabItemSchema } from '../content/schemas/vocab-item.schema';
import { KanjiEntry, KanjiEntrySchema } from '../content/schemas/kanji-entry.schema';
import { GrammarPoint, GrammarPointSchema } from '../content/schemas/grammar-point.schema';
import { KanaItem, KanaItemSchema } from '../content/schemas/kana-item.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminAction.name, schema: AdminActionSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: AppSetting.name, schema: AppSettingSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
      { name: Event.name, schema: EventSchema },
      { name: ContentReport.name, schema: ContentReportSchema },
      { name: Report.name, schema: ReportSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: ContentVersion.name, schema: ContentVersionSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: VocabItem.name, schema: VocabItemSchema },
      { name: KanjiEntry.name, schema: KanjiEntrySchema },
      { name: GrammarPoint.name, schema: GrammarPointSchema },
      { name: KanaItem.name, schema: KanaItemSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    NotificationModule,
    ContentModule,
    MailModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminContentController,
    AdminReportsController,
    AdminNotificationsController,
    AdminSettingsController,
    AdminMailController,
  ],
  providers: [AdminGuard, AuditService],
  exports: [AdminGuard, AuditService],
})
export class AdminModule {}
