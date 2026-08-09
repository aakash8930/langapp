import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { NotificationService } from '../../notification/notification.service';
import { User, UserDocument } from '../../user/schemas/user.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationsController {
  constructor(
    private readonly notifService: NotificationService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @Post('notifications/broadcast')
  async broadcast(
    @Body()
    body: {
      type: string;
      title: string;
      body: string;
      plan?: string;
      userIds?: string[];
    },
  ) {
    let userIds: string[];
    if (body.userIds?.length) {
      userIds = body.userIds;
    } else if (body.plan) {
      const users = await this.userModel.find({ 'subscription.plan': body.plan }).select('_id').exec();
      userIds = users.map((u) => u._id.toString());
    } else {
      const users = await this.userModel.find().select('_id').limit(1000).exec();
      userIds = users.map((u) => u._id.toString());
    }

    await this.notifService.createMany(
      userIds.map((userId) => ({
        userId,
        type: body.type as any,
        title: body.title,
        body: body.body,
      })),
    );

    return { sent: userIds.length };
  }
}
