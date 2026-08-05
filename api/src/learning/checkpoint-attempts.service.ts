import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import {
  CheckpointKind,
  CheckpointQuestion,
  UnitCheckpointAttempt,
  UnitCheckpointAttemptDocument,
} from './schemas/unit-checkpoint-attempt.schema';

/** Fraction of questions that must be right. */
export const CHECKPOINT_PASS_MARK = 0.8;

/** Prefix on the `unit` field of a combined-test row, so the index key stays self-describing. */
export const COMBINED_UNIT_PREFIX = 'combined:';

/**
 * Owns the `unitCheckpointAttempts` collection.
 *
 * Cross-module callers (`content/checkpoint`) inject this service through
 * `LearningModule` and never touch the model, the same arrangement
 * `ExerciseAttemptsService` has with `ExerciseService`.
 */
@Injectable()
export class CheckpointAttemptsService {
  constructor(
    @InjectModel(UnitCheckpointAttempt.name)
    private readonly attemptModel: Model<UnitCheckpointAttemptDocument>,
  ) {}

  /**
   * The learner's open (unsubmitted) attempt at this unit, if any.
   *
   * Starting a checkpoint returns this rather than generating a fresh set,
   * which is what makes a refresh mid-test resume instead of reshuffling —
   * and, more importantly, is what stops abandoning a hard set and starting
   * over until an easy one appears. A learner who wants different questions
   * has to submit the one they are holding.
   *
   * For a combined test, `unit` is the `combined:<hash>` marker; the same
   * `findOne` is what makes "leave the app and come back" land on the same
   * questions. The marker is deterministic in the unit-slug set, so a fresh
   * `start` for the *same* unit list returns the same attempt and never
   * produces a new row.
   */
  async findOpen(userId: string, unit: string): Promise<UnitCheckpointAttemptDocument | null> {
    return this.attemptModel
      .findOne({ userId: new Types.ObjectId(userId), unit, submittedAt: null })
      .exec();
  }

  async findAttempt(
    userId: string,
    unit: string,
    attempt: number,
  ): Promise<UnitCheckpointAttemptDocument | null> {
    return this.attemptModel
      .findOne({ userId: new Types.ObjectId(userId), unit, attempt })
      .exec();
  }

  /**
   * Create the next attempt for this (user, unit).
   *
   * The number is derived here — from the highest already stored — and never
   * taken from the request. The unique index is what makes that safe under a
   * double-tap: the loser of the race gets a duplicate-key error rather than a
   * second row sharing an attempt number.
   *
   * `kind` defaults to `'unit'` and `unitSlugs` to `[]` so the existing
   * per-unit call sites do not change. A combined test passes both
   * explicitly, with `unit` set to the `combined:<hash>` marker returned by
   * `combinedUnitMarker`.
   */
  async create(
    userId: string,
    unit: string,
    questions: CheckpointQuestion[],
    options: { kind?: CheckpointKind; unitSlugs?: string[] } = {},
  ): Promise<UnitCheckpointAttemptDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const latest = await this.attemptModel
      .findOne({ userId: userObjectId, unit })
      .sort({ attempt: -1 })
      .select('attempt')
      .exec();

    return this.attemptModel.create({
      userId: userObjectId,
      unit,
      kind: options.kind ?? 'unit',
      unitSlugs: options.unitSlugs ?? [],
      attempt: (latest?.attempt ?? 0) + 1,
      questions,
      submittedAt: null,
      score: null,
      passed: null,
    });
  }

  /**
   * Record one answer, **once**.
   *
   * The `questions.$.answered: false` clause is the whole of the one-shot rule:
   * a second answer to the same question matches nothing and changes nothing.
   * Enforced in the query rather than in the service above so that a retry, a
   * double-tap and a hostile client all hit the same wall.
   *
   * Returns `false` when nothing was written — the caller reports the stored
   * verdict rather than the new one, so answering twice is idempotent instead
   * of an error.
   */
  async recordAnswer(
    attemptId: Types.ObjectId,
    exerciseId: string,
    correct: boolean,
    responseTimeMs?: number,
  ): Promise<boolean> {
    const result = await this.attemptModel
      .updateOne(
        {
          _id: attemptId,
          submittedAt: null,
          questions: { $elemMatch: { exerciseId, answered: false } },
        },
        {
          $set: {
            'questions.$.answered': true,
            'questions.$.correct': correct,
            'questions.$.responseTimeMs': responseTimeMs ?? null,
          },
        },
      )
      .exec();

    return result.modifiedCount > 0;
  }

  /**
   * Close the attempt and store the verdict.
   *
   * `submittedAt: null` in the filter makes this exactly-once: a second submit
   * matches nothing, so the XP award above it cannot be collected twice by
   * pressing the button twice.
   */
  async submit(
    attemptId: Types.ObjectId,
    score: number,
    passed: boolean,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await this.attemptModel
      .updateOne(
        { _id: attemptId, submittedAt: null },
        { $set: { submittedAt: now, score, passed } },
      )
      .exec();

    return result.modifiedCount > 0;
  }

  /** Has this learner ever passed this unit? Decides the full-vs-practice award. */
  async hasPassed(userId: string, unit: string): Promise<boolean> {
    const passed = await this.attemptModel
      .findOne({ userId: new Types.ObjectId(userId), unit, passed: true })
      .select('_id')
      .exec();

    return passed !== null;
  }

  /** Every unit this learner has passed — for the client's unit list. */
  async passedUnits(userId: string): Promise<string[]> {
    const rows = await this.attemptModel
      .find({ userId: new Types.ObjectId(userId), passed: true, kind: 'unit' })
      .select('unit')
      .lean()
      .exec();

    return [...new Set(rows.map((row) => row.unit))].sort();
  }

  /** Has this learner ever passed a combined test? Decides the full-vs-practice award. */
  async hasPassedCombined(userId: string): Promise<boolean> {
    const passed = await this.attemptModel
      .findOne({ userId: new Types.ObjectId(userId), kind: 'combined', passed: true })
      .select('_id')
      .exec();

    return passed !== null;
  }

  /**
   * The deterministic `unit` value for a combined test.
   *
   * The hash is over the sorted slug list, so a learner who finishes the
   * same set of units gets the same marker — which is what makes
   * `findOpen` resume rather than regenerate. Adding a new finished unit
   * changes the marker and starts a new attempt row, which is also right:
   * a combined test against `{A, B}` and one against `{A, B, C}` are
   * different tests.
   *
   * The prefix is what makes the value self-describing in the index and
   * in logs — a row's `unit` field reads as `combined:abc123`, not a
   * slug that happens to look like a hash.
   */
  combinedUnitMarker(unitSlugs: readonly string[]): string {
    const sorted = [...unitSlugs].sort();
    const hash = createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16);
    return `${COMBINED_UNIT_PREFIX}${hash}`;
  }

  /**
   * Account-deletion cascade (OPEN-ITEMS #5/#32).
   *
   * Written in the same commit as the collection, deliberately: the learner
   * model spent two slices outside the cascade because it was added after the
   * cascade was written, and `DELETE /me` quietly stopped being the real
   * erasure the contract promises (OPEN-ITEMS #38).
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.attemptModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }
}
