import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const REPORT_REASONS = [
  'harassment',
  'spam',
  'inappropriate',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * A report of another learner, optionally about a specific message.
 *
 * ## Why the message text is copied in
 *
 * `messageText` snapshots what was reported. Without it, a report becomes
 * unreviewable the moment the sender deletes the message or the account goes —
 * which is precisely what someone does after sending something they should not
 * have. The snapshot is the evidence; the live message is not.
 *
 * ## There is no moderation queue yet
 *
 * Reports are write-only in this build: `status` starts `open` and nothing
 * changes it, because a review UI is a bigger thing than this slice and shipping
 * a broken one would be worse than shipping none. The rows accumulate and are
 * readable with `mongosh`, which for a 32-account app with a solo operator is a
 * defensible starting point — but it is a **stated gap, not an oversight**, and
 * it is in OPEN-ITEMS. The reason the write path exists now is that a reporting
 * button that goes nowhere is worse than one that files a row someone can read.
 */
@Schema({ collection: 'reports', timestamps: { createdAt: true, updatedAt: false } })
export class Report {
  @Prop({ type: Types.ObjectId, required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  subjectUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  messageId: Types.ObjectId | null;

  /** Snapshot of the reported message, so deletion cannot destroy the evidence. */
  @Prop({ type: String, default: null })
  messageText: string | null;

  @Prop({ type: String, required: true, enum: REPORT_REASONS })
  reason: ReportReason;

  @Prop({ type: String, default: '', maxlength: 1000 })
  note: string;

  @Prop({ type: String, required: true, enum: REPORT_STATUSES, default: 'open' })
  status: ReportStatus;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);

// The read a human triaging these would make.
ReportSchema.index({ status: 1, createdAt: -1 });
// "Has this person been reported before?" — the question that matters most.
ReportSchema.index({ subjectUserId: 1, createdAt: -1 });
