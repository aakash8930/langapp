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
 * Which test a row records. The two kinds share storage (one collection, one
 * schema) so the one-shot answer machinery and the exactly-once submit rule
 * apply to both, but they are not the same test:
 *
 *  - `unit` covers one unit. `unit` on the document is that unit's slug.
 *  - `combined` covers every unit the learner has *finished* at the moment the
 *    attempt started. `unit` on the document is a stable marker
 *    (`combined:<hash-of-sorted-slugs>`) so the attempt key stays unique and
 *    queryable; `unitSlugs` is the readable explanation of what was tested.
 *
 * A combined test that happens to cover one unit (the learner has only
 * finished one) is not allowed — the controller 422s. The schema still
 * permits it for the same reason it permits an empty `unitSlugs`: a
 * defensive default is cheaper than a stricter constraint that would have to
 * be loosened.
 */
export type CheckpointKind = 'unit' | 'combined';

/**
 * A unit checkpoint: the end-of-unit test, or a combined test across all
 * finished units.
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
   * The discriminator's value in the index. For a `unit` kind this is the
   * unit slug (`'hiragana-basics'`); for a `combined` kind this is
   * `combined:<stable-hash>` of the sorted finished-units list. Not an id —
   * Phase 2 §5 turns `Unit` into a real document with a `unitId`, and
   * keying on a slug now means that migration is a rename here rather than
   * a redesign. The slug is already what `Lesson.unit` and
   * `GET /lessons?unit=` use.
   */
  @Prop({ type: String, required: true, trim: true })
  unit: string;

  /**
   * Discriminates a per-unit attempt from a cross-unit one. Defaults to
   * `'unit'` so the collection's existing rows (pre-combined-test) are
   * valid without a backfill, and so the partial indexes below can keep
   * using the field.
   */
  @Prop({ type: String, required: true, enum: ['unit', 'combined'], default: 'unit' })
  kind: CheckpointKind;

  /**
   * The unit slugs a combined test covered. Empty for `kind: 'unit'`.
   *
   * `unit` (the slug-or-hash field) is the index key, so the hash is what
   * makes uniqueness work. This list is the human-readable explanation of
   * what was tested, persisted so a result screen can say "Hiragana basics
   * + Katakana basics" without re-deriving it from the question set.
   */
  @Prop({ type: [String], default: [] })
  unitSlugs: string[];

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

// "Every combined test this learner has passed" — the dashboard asks for this
// without scanning the unit-kind rows. Partial so the existing per-unit reads
// keep using their index; the kind is the discriminator the partial needs.
UnitCheckpointAttemptSchema.index(
  { userId: 1, passed: 1 },
  { partialFilterExpression: { kind: 'combined' } },
);
