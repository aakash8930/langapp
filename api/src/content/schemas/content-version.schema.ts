import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'content_versions', timestamps: true })
export class ContentVersion {
  @Prop({ type: String, required: true })
  contentType: string;

  @Prop({ type: Types.ObjectId, required: true })
  contentId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ type: Object, required: true })
  snapshot: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  editedBy: Types.ObjectId | null;
}

export type ContentVersionDocument = HydratedDocument<ContentVersion>;
export const ContentVersionSchema = SchemaFactory.createForClass(ContentVersion);
ContentVersionSchema.index({ contentType: 1, contentId: 1, version: -1 });
