import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ReminderProcessor } from './reminder.processor';
import { ReminderScheduler } from './reminder.scheduler';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Circular with UserModule (which imports NotificationModule for its own
    // reasons) — forwardRef on both sides breaks the load-order cycle.
    forwardRef(() => UserModule),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, ReminderScheduler, ReminderProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
