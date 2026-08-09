import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

interface FindAllFilter {
  type?: NotificationType;
  read?: boolean;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    return this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ?? {},
      read: false,
      readAt: null,
    });
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<NotificationDocument[]> {
    if (inputs.length === 0) return [];
    const docs = inputs.map((input) => ({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ?? {},
      read: false,
      readAt: null,
    }));
    return this.notificationModel.create(docs);
  }

  async findAll(
    userId: string,
    filter: FindAllFilter = {},
    page = 1,
    limit = 20,
  ): Promise<{ items: NotificationDocument[]; total: number }> {
    const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (filter.type) query.type = filter.type;
    if (filter.read !== undefined) query.read = filter.read;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.notificationModel
      .updateOne(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        { $set: { read: true, readAt: new Date() } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { $set: { read: true, readAt: new Date() } },
      )
      .exec();
    return result.modifiedCount;
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    }).exec();
  }
}
