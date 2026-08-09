import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'admin_actions', timestamps: true })
export class AdminAction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminId: Types.ObjectId;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  action: string;

  @Prop({ type: String, required: true })
  resource: string;

  @Prop({ type: String, default: null })
  resourceId: string | null;

  @Prop({ type: Object, default: {} })
  details: Record<string, unknown>;
}

export type AdminActionDocument = HydratedDocument<AdminAction>;
export const AdminActionSchema = SchemaFactory.createForClass(AdminAction);
AdminActionSchema.index({ adminId: 1, createdAt: -1 });
AdminActionSchema.index({ action: 1, createdAt: -1 });
