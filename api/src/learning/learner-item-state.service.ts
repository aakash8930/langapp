import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import {
  computeConfidence,
  computeItemMastery,
  EMPTY_STATS,
  pushOutcome,
  RECENT_OUTCOMES,
  updateStats,
} from './learner-model/confidence';
import {
  LearnerItemState,
  LearnerItemStateDocument,
  SourceContext,
} from './schemas/learner-item-state.schema';
import { SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

export interface BackfillReport {
  cards: number;
  created: number;
  /** Already had a state, left untouched. */
  skipped: number;
}

/**
 * One call to `record()`. Carries the minimum the service needs to mutate the
 * right row and recompute the derived fields. `exerciseType` is the value the
 * `LearnerItemState.byExerciseType` map should be keyed on — `null` on review
 * and chat contexts, by decision (2) of the slice.
 */
export interface RecordInput {
  userId: Types.ObjectId;
  itemRef: { kind: ContentKind; id: Types.ObjectId };
  outcome: { correct: boolean; responseTimeMs?: number };
  exerciseType: string | null;
  sourceContext: SourceContext;
}

/** Mongo duplicate-key error. Same value used in `exercise-attempts.service.ts`. */
const DUPLICATE_KEY = 11000;

/**
 * Owns `learnerItemStates` (§5.2, ADR-003).
 *
 * The write path landed 2026-07-28: `record()` mutates an existing row or
 * creates a new one for every lesson answer, review grade and chat correction.
 * Derived fields (`confidence`, `masteryLevel`) are recomputed on every write
 * from the evidence above them — `confidence.ts` is pure, which is what makes
 * a drift check possible (§5.2).
 *
 * Reads still live elsewhere — the first consumer is the next slice.
 */
@Injectable()
export class LearnerItemStateService {
  private readonly logger = new Logger(LearnerItemStateService.name);

  constructor(
    @InjectModel(LearnerItemState.name)
    private readonly stateModel: Model<LearnerItemStateDocument>,
    @InjectModel(SrsCard.name)
    private readonly cardModel: Model<SrsCardDocument>,
  ) {}

  /**
   * Create a `LearnerItemState` for every existing `SrsCard`, carrying over the
   * review evidence the card already holds.
   *
   * ## Why `SrsCard` is the only source
   *
   * ADR-003 says `totalReviews` / `correctReviews` should move off the card
   * "before they carry data worth preserving" — they now hold real counts for 386
   * cards, so the backfill preserves them instead of costing zeros.
   *
   * `ExerciseAttempt` **cannot** be backfilled, and that is worth knowing rather
   * than discovering later: it records `{userId, lessonId, attempt, exerciseId,
   * correct, responseTimeMs}` and **no item id and no exercise type**. `exerciseId`
   * is `{attempt}:{index}` — a position in a shuffle — so attributing a historical
   * answer to an item would mean regenerating every past exercise set against
   * content that has since changed. Lesson-level evidence therefore starts
   * accumulating when the write path lands, and `byExerciseType` is empty until
   * then. The fix for the future is `itemId` and `type` on the attempt row, which
   * the answer endpoint already has to hand.
   *
   * ## Idempotency
   *
   * Each card's state is looked up by `{userId, itemRef}` before inserting, so
   * running this twice is a no-op rather than a doubling — a migration that cannot
   * be re-run safely is a migration nobody dares re-run. The **unique index** is
   * the actual guarantee; the lookup is an optimisation, and a concurrent second
   * run fails loudly on a duplicate key instead of splitting one item's evidence
   * across two rows.
   *
   * **Existing states are not overwritten.** Once the write path is live, a state
   * holds evidence the card never had, and a re-run must not flatten it back to
   * review counts. Such rows are counted as skipped.
   */
  async backfillFromSrsCards(): Promise<BackfillReport> {
    const report: BackfillReport = { cards: 0, created: 0, skipped: 0 };

    // `cursor()` rather than `find()`: this walks every card of every learner, and
    // loading them all is exactly the kind of thing that is fine at 386 and not at
    // 386,000.
    for await (const card of this.cardModel.find().cursor()) {
      report.cards++;

      const existing = await this.stateModel
        .findOne({
          userId: card.userId,
          'itemRef.kind': card.itemRef.kind,
          'itemRef.id': card.itemRef.id,
        })
        .exec();

      if (existing) {
        // Already has a state — leave whatever evidence it has accumulated alone.
        report.skipped++;
        continue;
      }

      const exposures = card.totalReviews;
      const correct = Math.min(card.correctReviews, exposures);
      const incorrect = exposures - correct;

      const state = {
        userId: card.userId,
        itemRef: card.itemRef,
        exposures,
        correct,
        incorrect,
        // No response times survive: the card never stored any, and the attempts
        // that did cannot be attributed to an item.
        responseTimeMs: { ...EMPTY_STATS },
        lastNOutcomes: reconstructOutcomes(correct, incorrect),
        // Empty on purpose — see the note above on `ExerciseAttempt`.
        byExerciseType: new Map(),
        confidence: 0,
        masteryLevel: 'new' as const,
        firstSeenAt: card.createdAt ?? null,
        lastSeenAt: card.lastReview,
        // Every one of these counts came from grading a review.
        sourceContexts: exposures > 0 ? (['review'] as const) : [],
      };

      const confidence = computeConfidence({
        exposures: state.exposures,
        lastNOutcomes: state.lastNOutcomes,
        responseTimeMs: state.responseTimeMs,
        // No per-type baseline exists yet — `LearnerProfile` is §5.2 [Later] — so
        // the speed term is neutral for every backfilled row.
        baselineMs: null,
      });

      await this.stateModel.create({
        ...state,
        confidence,
        masteryLevel: computeItemMastery(confidence, state.exposures),
        sourceContexts: [...state.sourceContexts],
      });
      report.created++;
    }

    this.logger.log(
      `Backfill: ${report.cards} cards -> ${report.created} created, ` +
        `${report.skipped} already present`,
    );

    return report;
  }

  /**
   * Build this collection's declared indexes, and **wait for them**.
   *
   * Not optional, and not something Mongoose's `autoIndex` can be trusted to do
   * here: index creation is fired off during model init and not awaited, so a
   * short-lived process can exit first. Observed exactly that on the first
   * migration run against a copy of the real database — the unique index existed
   * and `{userId, confidence}` did not.
   *
   * It matters more than a missing index usually would, because the unique index
   * on `{userId, itemRef}` **is** the guarantee that one item has one state. The
   * backfill's lookup-before-insert is an optimisation; without the index built,
   * two concurrent runs could split an item's evidence across two rows.
   */
  async ensureIndexes(): Promise<void> {
    await this.stateModel.syncIndexes();
  }

  /**
   * Record one exposure of one item by one user.
   *
   * Reads the existing row, mutates it in memory with the pure functions in
   * `confidence.ts`, and writes the whole document back. The
   * read-then-mutate-then-write is racy under concurrency, so a duplicate-key
   * path on the unique index finishes the job atomically — same structural
   * guarantee that makes the backfill idempotent.
   *
   * ## Never throws
   *
   * Every caller is on a side-effect path: an answer endpoint, a review grade,
   * a chat turn. Losing the pedagogical-model write must not undo the user's
   * actual action — same failure semantics as `LearningService.scheduleMissedWords`
   * and `AnalyticsService.record`. A swallowed error is logged at warn.
   *
   * ## `byExerciseType` is only touched on exercises
   *
   * Per decision (2) of the slice: the map stays a recognition-vs-recall metric
   * for exercises. A review grade or a chat correction carries
   * `exerciseType: null`, and this method leaves the map unchanged in that
   * case. The totals (`exposures`, `correct`, `incorrect`), the recency ring,
   * the response-time stats and the provenance still accumulate.
   *
   * ## Derived fields are recomputed
   *
   * `confidence` and `masteryLevel` are recomputed on every call from the
   * mutated evidence. Storing them rather than computing on read makes session
   * composition cheap; the cost is that they can drift, which is why
   * `confidence.ts` is pure — `confidence.spec.ts` recomputes and compares.
   */
  async record(input: RecordInput): Promise<void> {
    try {
      await this.recordOnce(input);
    } catch (err) {
      this.logger.warn(
        `LearnerItemState record lost for user ${input.userId.toString()} ` +
          `${input.itemRef.kind} ${input.itemRef.id.toString()}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
      );
    }
  }

  private async recordOnce(input: RecordInput): Promise<void> {
    const { userId, itemRef, outcome, exerciseType, sourceContext } = input;
    const now = new Date();

    const existing = await this.stateModel
      .findOne({
        userId,
        'itemRef.kind': itemRef.kind,
        'itemRef.id': itemRef.id,
      })
      .exec();

    if (!existing) {
      await this.createFromScratch(userId, itemRef, outcome, exerciseType, sourceContext, now);
      return;
    }

    await this.mutateAndWrite(existing, outcome, exerciseType, sourceContext, now);
  }

  /**
   * Build a fresh state for a first-seen item. Confidence and mastery are
   * recomputed from the (single-sample) evidence so the row is consistent on
   * creation rather than after the first read.
   *
   * The unique index on `{userId, itemRef}` rejects a racing duplicate; the
   * caller treats that as a lost write and lets the winner own the row.
   */
  private async createFromScratch(
    userId: Types.ObjectId,
    itemRef: { kind: ContentKind; id: Types.ObjectId },
    outcome: { correct: boolean; responseTimeMs?: number },
    exerciseType: string | null,
    sourceContext: SourceContext,
    now: Date,
  ): Promise<void> {
    const responseTimeMs =
      outcome.responseTimeMs !== undefined ? updateStats(EMPTY_STATS, outcome.responseTimeMs) : { ...EMPTY_STATS };
    const lastNOutcomes = pushOutcome([], outcome.correct);
    const byExerciseType = new Map<string, { seen: number; correct: number }>();
    if (exerciseType !== null) {
      byExerciseType.set(exerciseType, { seen: 1, correct: outcome.correct ? 1 : 0 });
    }
    const exposures = 1;
    const correct = outcome.correct ? 1 : 0;
    const incorrect = outcome.correct ? 0 : 1;
    const confidence = computeConfidence({
      exposures,
      lastNOutcomes,
      responseTimeMs,
      baselineMs: null,
    });

    try {
      await this.stateModel.create({
        userId,
        itemRef,
        exposures,
        correct,
        incorrect,
        responseTimeMs,
        lastNOutcomes,
        byExerciseType,
        confidence,
        masteryLevel: computeItemMastery(confidence, exposures),
        firstSeenAt: now,
        lastSeenAt: now,
        sourceContexts: [sourceContext],
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        // A concurrent record() won the race for this row. The winner now
        // owns it; the loser mutates on its own next call rather than
        // overwriting. Falling through would double-count this exposure, so
        // the unique index is doing its job by stopping us here.
        return;
      }
      throw err;
    }
  }

  /**
   * Update the existing row: bump counters, push onto the ring, refresh
   * provenance and derived fields, write the whole document. The ring is
   * capped at RECENT_OUTCOMES so the row never grows without bound.
   *
   * `findOneAndUpdate` rather than a `save()`: `save()` would race with other
   * writers under the read-modify-write cycle, and the unique index is what
   * guarantees the in-memory state is the right one to write.
   */
  private async mutateAndWrite(
    existing: LearnerItemStateDocument,
    outcome: { correct: boolean; responseTimeMs?: number },
    exerciseType: string | null,
    sourceContext: SourceContext,
    now: Date,
  ): Promise<void> {
    const exposures = existing.exposures + 1;
    const correct = existing.correct + (outcome.correct ? 1 : 0);
    const incorrect = existing.incorrect + (outcome.correct ? 0 : 1);
    const lastNOutcomes = pushOutcome(existing.lastNOutcomes ?? [], outcome.correct);
    const responseTimeMs =
      outcome.responseTimeMs !== undefined
        ? updateStats(existing.responseTimeMs ?? { ...EMPTY_STATS }, outcome.responseTimeMs)
        : (existing.responseTimeMs ?? { ...EMPTY_STATS });

    // Decision (2): only exercise contexts touch the per-type map. The
    // map's `byExerciseType.set(...)` mutation is fine on a Mongoose Map
    // because we are writing the whole map back below.
    let byExerciseType: Map<string, { seen: number; correct: number }>;
    if (exerciseType !== null) {
      byExerciseType = new Map(existing.byExerciseType ?? new Map());
      const prior = byExerciseType.get(exerciseType) ?? { seen: 0, correct: 0 };
      byExerciseType.set(exerciseType, {
        seen: prior.seen + 1,
        correct: prior.correct + (outcome.correct ? 1 : 0),
      });
    } else {
      byExerciseType = new Map(existing.byExerciseType ?? new Map());
    }

    const sourceContexts = dedupeSourceContexts([...(existing.sourceContexts ?? []), sourceContext]);

    const confidence = computeConfidence({
      exposures,
      lastNOutcomes,
      responseTimeMs,
      // `LearnerProfile` is §5.2 [Later] — no per-type baseline exists, so the
      // speed term is neutral for every call. Recording this here rather than
      // somewhere the next reader has to rediscover it.
      baselineMs: null,
    });

    await this.stateModel
      .updateOne(
        { _id: existing._id },
        {
          $set: {
            exposures,
            correct,
            incorrect,
            lastNOutcomes,
            responseTimeMs,
            byExerciseType,
            sourceContexts,
            confidence,
            masteryLevel: computeItemMastery(confidence, exposures),
            // Provenance: sticky firstSeenAt, refreshed lastSeenAt.
            firstSeenAt: existing.firstSeenAt ?? now,
            lastSeenAt: now,
          },
        },
      )
      .exec();
  }

  /** How many states exist — for migration verification. */
  async count(): Promise<number> {
    return this.stateModel.countDocuments().exec();
  }

  /**
   * The learner's evidence for a specific set of items, keyed `"kind:id"`.
   *
   * The first read path on this collection (§5.2 said the first consumer would
   * be a later slice; the unit checkpoint is it). Items with no row are simply
   * absent from the map rather than defaulted here — "never seen" and "seen and
   * scored 0" are different facts, and only the caller knows which way it wants
   * to rank them.
   *
   * One query for the whole set. The `{userId, confidence}` index does not
   * serve this (it filters on `itemRef`), but the unique
   * `{userId, itemRef.kind, itemRef.id}` index does.
   */
  async findEvidenceForItems(
    userId: string,
    refs: { kind: ContentKind; id: Types.ObjectId }[],
  ): Promise<Map<string, { confidence: number; exposures: number }>> {
    if (refs.length === 0) return new Map();

    const rows = await this.stateModel
      .find({
        userId: new Types.ObjectId(userId),
        $or: refs.map((ref) => ({ 'itemRef.kind': ref.kind, 'itemRef.id': ref.id })),
      })
      .select('itemRef confidence exposures')
      .lean()
      .exec();

    return new Map(
      rows.map((row) => [
        `${row.itemRef.kind}:${row.itemRef.id.toString()}`,
        { confidence: row.confidence, exposures: row.exposures },
      ]),
    );
  }

  /**
   * Account-deletion cascade (OPEN-ITEMS #5/#32).
   *
   * Called by `LearningService.deleteAllForUser` as part of `DELETE /me`. This
   * collection was added after the cascade was written and spent two slices
   * outside it, so a deleted account left its learner model behind — rows keyed
   * by a `userId` with no user, holding per-item evidence of what that person
   * got wrong. The contract calls `DELETE /me` a real cascade; this is part of
   * making that true.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.stateModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: number }).code;
  // insertMany with ordered:false reports a BulkWriteError wrapping per-doc codes;
  // a single insert surfaces a plain error with code 11000.
  const writeErrors = (err as { writeErrors?: { err?: { code?: number } }[] }).writeErrors;
  return code === DUPLICATE_KEY || !!writeErrors?.some((e) => e.err?.code === DUPLICATE_KEY);
}

/**
 * Order-stable dedupe: `sourceContexts` is appended-to, so the order carries
 * information ("learner met this first in chat, then again in review"). The
 * membership test just drops a duplicate if it ever appears twice — a
 * re-recorded lesson does not push a second `'lesson'` entry.
 */
function dedupeSourceContexts(values: SourceContext[]): SourceContext[] {
  const seen = new Set<SourceContext>();
  const out: SourceContext[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Rebuild a plausible recency ring from two totals.
 *
 * The card knows *how many* reviews were correct but not **in what order**, and
 * recency is the whole point of the ring. Ordering the failures first is the
 * deliberate choice: it makes the most recent outcomes the correct ones, so a
 * learner who has since improved is not punished by a history that never recorded
 * when they improved. The opposite order would depress confidence for every item
 * ever failed once.
 *
 * This is reconstruction, not data. It is why backfilled confidence should be read
 * as a starting estimate — the honest alternative, an empty ring, scores every
 * item 0 and would surface hundreds of well-known items as weak on the first
 * adaptive session.
 */
function reconstructOutcomes(correct: number, incorrect: number): boolean[] {
  const total = Math.min(correct + incorrect, RECENT_OUTCOMES);
  if (total === 0) return [];

  // Proportional within the window, so 20 reviews at 90% reads as 9 of 10.
  const scale = total / (correct + incorrect);
  const wrong = Math.min(total, Math.round(incorrect * scale));

  let outcomes: boolean[] = [];
  for (let i = 0; i < wrong; i++) outcomes = pushOutcome(outcomes, false);
  for (let i = 0; i < total - wrong; i++) outcomes = pushOutcome(outcomes, true);

  return outcomes;
}
