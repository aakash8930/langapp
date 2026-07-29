import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  CONTENT_KINDS,
  ContentKind,
} from '../../knowledge-graph/schemas/knowledge-node.schema';

/**
 * One question inside a checkpoint attempt, **including its answer key**.
 *
 * This is the difference between a checkpoint and a lesson exercise, and the
 * reason this collection exists at all. `ExerciseService` stores nothing:
 * generation is a pure function of `(lesson, user, attempt)`, so answering
 * re-derives the same set and checks against it. That works because the client
 * supplies the attempt number and a re-roll costs nothing — the lesson re-asks
 * a wrong answer until it is right, so an easier shuffle is not worth having.
 *
 * A checkpoint is scored once, in one pass, so both properties invert:
 *
 *  - the attempt number **must** be server-issued, or a client picks its own
 *    seed until it likes the questions (the reroll hole of OPEN-ITEMS #4a,
 *    harmless on a lesson and not here);
 *  - the sampled set is drawn from the learner's own weakest items, so it is
 *    *not* reproducible from the seed alone — the weights move as the learner
 *    answers, and re-deriving at submit time would score them against a
 *    different set than they saw.
 *
 * So the set is persisted at start and read back on every answer. The answer
 * key living in the database is safe in a way regenerating it is not: it is
 * behind a per-user query and no route serialises these fields.
 */
@Schema({ _id: false })
export class CheckpointQuestion {
  /** `{attempt}:{index}` — same shape the exercise routes use. */
  @Prop({ type: String, required: true })
  exerciseId: string;

  @Prop({ type: Types.ObjectId, required: true })
  itemId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: CONTENT_KINDS })
  itemKind: ContentKind;

  /** `multipleChoice` or `wordReading`, whichever the source unit teaches. */
  @Prop({ type: String, required: true })
  exerciseType: string;

  @Prop({ type: String, required: true })
  promptKind: string;

  @Prop({ type: String, required: true })
  prompt: string;

  @Prop({ type: String, required: true })
  question: string;

  /** Empty for `wordReading`, which has no options. */
  @Prop({ type: [{ id: String, value: String }], default: [] })
  options: { id: string; value: string }[];

  /** Answer key. Never serialised — see the class comment. */
  @Prop({ type: String, default: '' })
  correctOptionId: string;

  @Prop({ type: String, required: true })
  correctValue: string;

  // ---- filled in as the learner answers ----

  @Prop({ type: Boolean, required: true, default: false })
  answered: boolean;

  /**
   * One shot. Unlike `ExerciseAttempt.correct`, which is promoted false → true
   * because a lesson re-asks until the learner is right, this is whatever the
   * single answer was. A test that lets you retry a question until it goes
   * green measures nothing.
   */
  @Prop({ type: Boolean, required: true, default: false })
  correct: boolean;

  @Prop({ type: Number, default: null, min: 0 })
  responseTimeMs: number | null;
}
export const CheckpointQuestionSchema = SchemaFactory.createForClass(CheckpointQuestion);

/**
 * A unit checkpoint: the end-of-unit test.
 *
 * Owned by `learning` rather than `content` for the same reason
 * `exerciseAttempts` is — this is a record of what a *learner* did, not
 * content. Generation lives in `content`, which is where the item pools and
 * the question shapes already are (OPEN-ITEMS #10a).
 */
@Schema({ collection: 'unitCheckpointAttempts', timestamps: true })
export class UnitCheckpointAttempt {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /**
   * The unit *slug* (`'hiragana-basics'`), not an id. Phase 2 §5 turns `Unit`
   * into a real document with a `unitId`; keying on the slug now means that
   * migration is a rename here rather than a redesign, and the slug is already
   * what `Lesson.unit` and `GET /lessons?unit=` use.
   */
  @Prop({ type: String, required: true, trim: true })
  unit: string;

  /** Server-issued, 1-based. Never taken from the request. */
  @Prop({ type: Number, required: true, min: 1 })
  attempt: number;

  @Prop({ type: [CheckpointQuestionSchema], required: true, default: [] })
  questions: CheckpointQuestion[];

  @Prop({ type: Date, default: null })
  submittedAt: Date | null;

  /** Fraction 0..1, set at submit. `null` while the attempt is open. */
  @Prop({ type: Number, default: null, min: 0, max: 1 })
  score: number | null;

  @Prop({ type: Boolean, default: null })
  passed: boolean | null;
}

export type UnitCheckpointAttemptDocument = HydratedDocument<UnitCheckpointAttempt>;
export const UnitCheckpointAttemptSchema =
  SchemaFactory.createForClass(UnitCheckpointAttempt);

// One row per (user, unit, attempt). Unique because two rows for one attempt
// would split the answers across them and score whichever was read.
UnitCheckpointAttemptSchema.index({ userId: 1, unit: 1, attempt: 1 }, { unique: true });

// "The open attempt for this user and unit" — the resume read, on every start.
UnitCheckpointAttemptSchema.index({ userId: 1, unit: 1, submittedAt: 1 });
