import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const CONTENT_REPORT_ISSUES = [
  'typo',
  'audio_mismatch',
  'wrong_translation',
  'bad_distractor',
  'other',
] as const;
export type ContentReportIssue = (typeof CONTENT_REPORT_ISSUES)[number];

export const CONTENT_REPORT_STATUSES = ['open', 'reviewed', 'resolved'] as const;
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];

/**
 * OPEN-ITEMS #8: "Report a mistake" affordance on content items.
 * Allows learners to report typos, audio errors, translation mistakes, or bad questions.
 */
@Schema({ collection: 'contentReports', timestamps: { createdAt: true, updatedAt: false } })
export class ContentReport {
  @Prop({ type: Types.ObjectId, required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['kana', 'vocab', 'grammar', 'kanji', 'lesson'] })
  itemKind: string;

  @Prop({ type: Types.ObjectId, required: true })
  itemId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: CONTENT_REPORT_ISSUES })
  issueType: ContentReportIssue;

  @Prop({ type: String, default: '', maxlength: 1000 })
  description: string;

  @Prop({ type: String, required: true, enum: CONTENT_REPORT_STATUSES, default: 'open' })
  status: ContentReportStatus;
}

export type ContentReportDocument = HydratedDocument<ContentReport>;
export const ContentReportSchema = SchemaFactory.createForClass(ContentReport);

ContentReportSchema.index({ status: 1, createdAt: -1 });
ContentReportSchema.index({ itemId: 1, createdAt: -1 });
