import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const PRACTICE_MODES = [
  'daily',
  'mixed',
  'weak',
  'timed',
  'random',
  'challenge',
] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const PRACTICE_SKILLS = ['vocabulary', 'kanji', 'grammar', 'reading'] as const;
export type PracticeSkill = (typeof PRACTICE_SKILLS)[number];

@Schema({ _id: false })
export class PracticeOption {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  value: string;
}
export const PracticeOptionSchema = SchemaFactory.createForClass(PracticeOption);

/** Public question data plus the lesson identity required for server grading. */
@Schema({ _id: false })
export class PracticeQuestion {
  @Prop({ required: true })
  id: string;

  @Prop({ type: Types.ObjectId, required: true })
  lessonId: Types.ObjectId;

  @Prop({ required: true })
  lessonTitle: string;

  @Prop({ required: true })
  unit: string;

  @Prop({ type: String, required: true, enum: PRACTICE_SKILLS })
  skill: PracticeSkill;

  @Prop({ required: true })
  exerciseId: string;

  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  promptKind: string;

  @Prop({ required: true })
  question: string;

  @Prop({ type: [PracticeOptionSchema], default: undefined })
  options?: PracticeOption[];
}
export const PracticeQuestionSchema = SchemaFactory.createForClass(PracticeQuestion);

/** Answer keys exist only after the grader has returned a result. */
@Schema({ _id: false })
export class PracticeAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ type: String, required: true, enum: PRACTICE_SKILLS })
  skill: PracticeSkill;

  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  correct: boolean;

  @Prop({ type: String, default: null })
  selectedValue: string | null;

  @Prop({ required: true })
  correctValue: string;

  @Prop({ required: true, min: 0 })
  responseTimeMs: number;

  @Prop({ required: true, min: 0 })
  points: number;

  @Prop({ required: true, min: 0 })
  combo: number;

  @Prop({ type: Date, required: true })
  answeredAt: Date;
}
export const PracticeAnswerSchema = SchemaFactory.createForClass(PracticeAnswer);

@Schema({ _id: false })
export class PracticeFilters {
  @Prop({ type: [String], default: [] })
  skills: PracticeSkill[];

  @Prop({ type: String, default: 'all' })
  level: string;
}
export const PracticeFiltersSchema = SchemaFactory.createForClass(PracticeFilters);

/**
 * One durable generated-exercise session. It stores no answer key in the
 * question list; correct values arrive only as each answer is server-graded.
 */
@Schema({ collection: 'practiceSessions', timestamps: true })
export class PracticeSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: PRACTICE_MODES })
  mode: PracticeMode;

  @Prop({ type: String, required: true, enum: ['active', 'completed'], default: 'active' })
  status: 'active' | 'completed';

  @Prop({ type: [PracticeQuestionSchema], required: true })
  questions: PracticeQuestion[];

  @Prop({ type: [PracticeAnswerSchema], required: true, default: [] })
  answers: PracticeAnswer[];

  @Prop({ type: PracticeFiltersSchema, required: true, default: () => ({}) })
  filters: PracticeFilters;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  @Prop({ type: Date, default: null })
  deadlineAt: Date | null;

  @Prop({ type: Number, default: null, min: 1 })
  timeLimitSeconds: number | null;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  score: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  maxCombo: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  xpAwarded: number;

  @Prop({ type: Number, default: null, min: 0 })
  durationSeconds: number | null;
}

export type PracticeSessionDocument = HydratedDocument<PracticeSession>;
export const PracticeSessionSchema = SchemaFactory.createForClass(PracticeSession);
PracticeSessionSchema.index({ userId: 1, createdAt: -1 });
PracticeSessionSchema.index({ userId: 1, mode: 1, completedAt: -1 });
