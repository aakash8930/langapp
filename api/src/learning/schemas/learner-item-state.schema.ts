import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ItemMasteryLevel } from '../learner-model/confidence';
import { SrsItemRef, SrsItemRefSchema } from './srs-card.schema';

export const ITEM_MASTERY_LEVELS: ItemMasteryLevel[] = [
  'new',
  'learning',
  'familiar',
  'mastered',
];

/**
 * Where the learner has been seen practising an item. §5.2's provenance field.
 *
 * `lesson` and `review` are written today; `chat` exists because a correction
 * already touches the SRS (T1.5) and `reading` is reserved for §6.7. Recorded so
 * that "weak on へ" can eventually distinguish weak *in a quiz* from weak *in
 * conversation*.
 */
export const SOURCE_CONTEXTS = ['lesson', 'review', 'chat', 'reading'] as const;
export type SourceContext = (typeof SOURCE_CONTEXTS)[number];

/** Welford running statistics (§5.2) — mean and variance in constant space. */
@Schema({ _id: false })
export class RunningStatsDoc {
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  count: number;

  @Prop({ type: Number, required: true, default: 0 })
  mean: number;

  /** Sum of squared deviations. Variance is `m2 / count`, never stored. */
  @Prop({ type: Number, required: true, default: 0 })
  m2: number;
}
export const RunningStatsSchema = SchemaFactory.createForClass(RunningStatsDoc);

/** Per-exercise-type tallies — what makes a weakness specific (§5.2). */
@Schema({ _id: false })
export class ExerciseTypeStats {
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  seen: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  correct: number;
}
export const ExerciseTypeStatsSchema = SchemaFactory.createForClass(ExerciseTypeStats);

/**
 * §5.2 / ADR-003: the pedagogical model for one `(user, item)` pair.
 *
 * ## Why this is not fields on `SrsCard`
 *
 * `SrsCard` is FSRS's state and nothing else. The two are read together only when
 * something needs both, and the hottest query in the app — `{userId, due}` —
 * serves entirely from a compound index; hanging confidence, response-time
 * distributions and per-exercise-type tallies off it would bloat that read for
 * every learner on every session. Two documents per item per learner is 24k
 * documents at this size, which is nothing; ADR-003 names 100k learners as the
 * point to revisit, not a date.
 *
 * ## What it replaces
 *
 * Hearts and gems (Phase 2 §3.1) collected exactly one useful signal — *where a
 * learner errs* — and removing them left nothing holding it. This is the rebuilt
 * home for that signal, and until something writes to it the only per-attempt
 * evidence in the system is the raw `ExerciseAttempt` row.
 *
 * ## The rule that must not be broken
 *
 * Nothing here is scheduling state. **`confidence` and `masteryLevel` may never be
 * written back into `stability`, `difficulty`, `state`, `reps` or `lapses`** —
 * §6.1 is explicit, and the precedent is `scheduleMissedWords`, which moves `due`
 * and writes nothing else. Feeding the scheduler observations that never happened
 * degrades every interval it computes afterwards.
 *
 * `confidence` and `masteryLevel` are **derived and stored**: read on every session
 * composition, written only on answer, so the asymmetry favours storing them. They
 * must stay recomputable from the evidence above them — `confidence.spec.ts` pins
 * that the computation is pure and deterministic, which is what makes a drift
 * check possible at all.
 */
@Schema({ collection: 'learnerItemStates', timestamps: true })
export class LearnerItemState {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /**
   * Reuses `SrsCard`'s ref shape deliberately: the two documents share a key, and
   * a second, subtly different `{kind, id}` embedded type is how they would drift
   * apart.
   */
  @Prop({ type: SrsItemRefSchema, required: true })
  itemRef: SrsItemRef;

  // ---- evidence (§5.2) ----

  /** Times the item has been put in front of the learner. */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  exposures: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  correct: number;

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  incorrect: number;

  @Prop({ type: RunningStatsSchema, required: true, default: () => ({}) })
  responseTimeMs: RunningStatsDoc;

  /**
   * Ring buffer of the last 10 outcomes, oldest first, for recency. An array of
   * every outcome ever would grow without bound and is never read in full.
   */
  @Prop({ type: [Boolean], required: true, default: [] })
  lastNOutcomes: boolean[];

  /**
   * `{ multipleChoice: { seen, correct }, wordReading: … }`.
   *
   * A `Map` rather than a fixed shape because exercise types are a plugin point
   * (`exercise-plugin.ts`) — a new type must not need a schema change. This is
   * what turns "weak on へ" into "recognises へ in multiple choice, cannot produce
   * it when typing", which is the recognition-versus-recall gap OPEN-ITEMS #10b
   * already flagged.
   */
  @Prop({ type: Map, of: ExerciseTypeStatsSchema, required: true, default: () => new Map() })
  byExerciseType: Map<string, ExerciseTypeStats>;

  // ---- derived, recomputed on write (§5.2) ----

  @Prop({ type: Number, required: true, default: 0, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: String, required: true, enum: ITEM_MASTERY_LEVELS, default: 'new' })
  masteryLevel: ItemMasteryLevel;

  // ---- provenance (§5.2) ----

  @Prop({ type: Date, default: null })
  firstSeenAt: Date | null;

  @Prop({ type: Date, default: null })
  lastSeenAt: Date | null;

  @Prop({ type: [String], required: true, default: [], enum: SOURCE_CONTEXTS })
  sourceContexts: SourceContext[];
}

export type LearnerItemStateDocument = HydratedDocument<LearnerItemState>;
export const LearnerItemStateSchema = SchemaFactory.createForClass(LearnerItemState);

// One state per (user, item) — the same key `SrsCard` uses, so the pair can be
// read together. Unique because a second row would split one item's evidence in
// two and silently halve every count derived from it.
LearnerItemStateSchema.index(
  { userId: 1, 'itemRef.kind': 1, 'itemRef.id': 1 },
  { unique: true },
);

// "This learner's weakest items" — the read selection will make (§6.1), which
// wants the low end of confidence for one user without scanning their whole set.
LearnerItemStateSchema.index({ userId: 1, confidence: 1 });
