import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import {
  ExerciseAttempt,
  ExerciseAttemptDocument,
} from './schemas/exercise-attempt.schema';

/** Mongo duplicate-key error. Same value used in `learning.service.ts`. */
const DUPLICATE_KEY = 11000;

/**
 * The content-item identification a question was about. Bag rather than three
 * positionals so the call site does not have to keep three optional values
 * aligned with `recordAttempt`'s positional signature.
 *
 * Every field may be `null`: historic rows predate the slice, and tests that
 * don't care about the learner model can pass nulls. The values are stored as-is
 * — `wordReading` is mapped to `'vocab'` at the call site, not here, because
 * the mapping belongs with the answer endpoint that knows the prompt kind.
 */
export interface AttemptItem {
  itemId: Types.ObjectId | null;
  itemKind: ContentKind | null;
  exerciseType: string | null;
}

/**
 * Owns the `exerciseAttempts` collection. Exposes only the two operations
 * anyone needs: record one attempt, and count attempts for a lesson.
 *
 * Cross-module callers (`content/exercise`) import this through `LearningModule`
 * and inject the service directly — they do not touch the model. The rule
 * "a module never touches another module's collections" is preserved: only
 * this class writes to or reads from `exerciseAttempts`.
 */
@Injectable()
export class ExerciseAttemptsService {
  constructor(
    @InjectModel(ExerciseAttempt.name)
    private readonly attemptModel: Model<ExerciseAttemptDocument>,
  ) {}

  /**
   * Write one attempt, or upgrade an existing one from wrong to right.
   *
   * Returns `true` when a new row was created, `false` when one already existed
   * (whether or not this call upgraded it).
   *
   * ## Why this is an upsert and not an insert
   *
   * It *was* insert-only: re-answering the same (user, lesson, attempt, exercise)
   * was a no-op, so the first answer's verdict was permanent. That became wrong
   * the moment lessons started re-asking questions the learner got wrong —
   * `correct` would stay `false` forever even after they answered it correctly,
   * and any gate reading these rows could never be satisfied.
   *
   * ## The one-way rule
   *
   * `correct` only ever goes **false → true**, never back. The filter carries
   * `correct: false`, so a re-answer that is also wrong matches nothing and
   * changes nothing, and a right answer cannot later be undone by a wrong one.
   *
   * That fixes the semantics of the field: it means *"the learner got this right
   * at some point during this attempt"*, which is the only reading that supports
   * "you must answer everything correctly to finish" while still letting someone
   * recover from a mistake. Storing "their most recent answer" instead would make
   * a learner who idly re-opened a finished lesson and mis-tapped lose credit for
   * work already done.
   */
  async recordAttempt(
    userId: string,
    lessonId: string,
    attempt: number,
    exerciseId: string,
    correct: boolean,
    responseTimeMs?: number,
    item: AttemptItem = { itemId: null, itemKind: null, exerciseType: null },
  ): Promise<boolean> {
    const key = {
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
      attempt,
      exerciseId,
    };

    try {
      await this.attemptModel.create({
        ...key,
        correct,
        responseTimeMs: responseTimeMs ?? null,
        itemId: item.itemId,
        itemKind: item.itemKind,
        exerciseType: item.exerciseType,
      });
      return true;
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }

      // The row exists. Promote it to correct if this answer was right; a wrong
      // re-answer matches nothing because of the `correct: false` clause.
      //
      // The item fields carry forward too: the row's `itemId` reflects the
      // first answer that had it, which is fine because both answers target
      // the same shuffled position (`exerciseId` is unique per attempt). A
      // first write with `null` followed by a second write with values leaves
      // the row with `null` — that is the chosen order: the schema is
      // optional, the completion gate doesn't read it, and a future backfill
      // can repair the historic `null`s without these writes fighting it.
      if (correct) {
        await this.attemptModel
          .updateOne(
            { ...key, correct: false },
            {
              $set: {
                correct: true,
                ...(responseTimeMs !== undefined ? { responseTimeMs } : {}),
                ...(item.itemId !== null ? { itemId: item.itemId } : {}),
                ...(item.itemKind !== null ? { itemKind: item.itemKind } : {}),
                ...(item.exerciseType !== null ? { exerciseType: item.exerciseType } : {}),
              },
            },
          )
          .exec();
      }
      return false;
    }
  }

  /**
   * Has the learner finished *some* attempt of this lesson with nothing left
   * wrong?
   *
   * This is the completion gate's read. Grouped **per attempt number**, and that
   * grouping is the point: a learner who made a mess of attempt 1 and then did
   * attempt 2 cleanly has plainly earned the completion, so scanning all their
   * rows in aggregate would punish them for the earlier try. Conversely,
   * abandoning attempt 2 half-finished with a wrong answer outstanding does not
   * un-earn attempt 1.
   *
   * "Clean" is `answered ≥ 1 and incorrect = 0`. Because `recordAttempt` only
   * promotes false→true, a surviving `false` row means "asked, got it wrong, and
   * never since got it right" — exactly the thing that should block finishing.
   *
   * `/complete` carries no attempt number, which is why this searches rather than
   * being told which attempt to check. Adding one to the request body would let a
   * caller nominate their cleanest attempt, which is the same thing this computes
   * but trusting the client to do it.
   */
  async hasCleanAttemptForLesson(userId: string, lessonId: string): Promise<boolean> {
    const rows = await this.attemptModel
      .aggregate<{ _id: number }>([
        {
          $match: {
            userId: new Types.ObjectId(userId),
            lessonId: new Types.ObjectId(lessonId),
          },
        },
        {
          $group: {
            _id: '$attempt',
            answered: { $sum: 1 },
            incorrect: { $sum: { $cond: ['$correct', 0, 1] } },
          },
        },
        { $match: { answered: { $gte: 1 }, incorrect: 0 } },
        { $limit: 1 },
      ])
      .exec();

    return rows.length > 0;
  }

  /**
   * OPEN-ITEMS #4a: Returns the latest attempt number for a user and lesson.
   * If no attempt exists, returns 0.
   */
  async getLatestAttempt(userId: string, lessonId: string): Promise<number> {
    const latest = await this.attemptModel
      .findOne({ userId: new Types.ObjectId(userId), lessonId: new Types.ObjectId(lessonId) })
      .sort({ attempt: -1 })
      .select('attempt')
      .exec();

    return latest ? latest.attempt : 0;
  }

  /**
   * "Has this user answered anything for this lesson?" — the gate read.
   * Returns the row count; a positive number satisfies the gate. Index
   * `{userId, lessonId}` makes this an O(1) index seek at Phase 0 volume.
   */
  async countAttemptsForLesson(userId: string, lessonId: string): Promise<number> {
    return this.attemptModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      })
      .exec();
  }

  /**
   * Account-deletion cascade (OPEN-ITEMS #5/#32).
   * Called by LearningService.deleteAllForUser as part of the DELETE /me cascade.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.attemptModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: number }).code;
  return code === DUPLICATE_KEY;
}