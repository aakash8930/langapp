import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  computeConfidence,
  computeItemMastery,
  EMPTY_STATS,
  pushOutcome,
  RECENT_OUTCOMES,
} from './learner-model/confidence';
import {
  LearnerItemState,
  LearnerItemStateDocument,
} from './schemas/learner-item-state.schema';
import { SrsCard, SrsCardDocument } from './schemas/srs-card.schema';

export interface BackfillReport {
  cards: number;
  created: number;
  /** Already had a state, left untouched. */
  skipped: number;
}

/**
 * Owns `learnerItemStates` (§5.2, ADR-003).
 *
 * At this slice it does one thing: **backfill from the evidence that already
 * exists**. Nothing reads the collection yet and nothing writes it on the request
 * path — that is deliberate sequencing, per §5.4's "additive first": the field
 * lands and is verified before any code depends on it.
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

  /** How many states exist — for migration verification. */
  async count(): Promise<number> {
    return this.stateModel.countDocuments().exec();
  }
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
