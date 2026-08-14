import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { NotificationService } from '../../notification/notification.service';
import { Notification, NotificationDocument } from '../../notification/schemas/notification.schema';
import { User, UserDocument } from '../../user/schemas/user.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationsController {
  constructor(
    private readonly notifService: NotificationService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  @Get('notifications')
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit ?? '25', 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      this.notificationModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .exec(),
      this.notificationModel.countDocuments().exec(),
    ]);

    return {
      items: items.map((n) => ({
        id: n._id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.get('createdAt'),
      })),
      total,
      page: pageNum,
    };
  }

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
