import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'achievement',
  'streak',
  'goal',
  'community',
  'course',
  'system',
  'reminder',
  'event',
  'marketing',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Schema({ collection: 'notifications', timestamps: { createdAt: true } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: NOTIFICATION_TYPES })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  read: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
