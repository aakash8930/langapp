import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExerciseAttempt,
  ExerciseAttemptDocument,
} from './schemas/exercise-attempt.schema';

/** Mongo duplicate-key error. Same value used in `learning.service.ts`. */
const DUPLICATE_KEY = 11000;

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
  ): Promise<boolean> {
    const key = {
      userId: new Types.ObjectId(userId),
      lessonId: new Types.ObjectId(lessonId),
      attempt,
      exerciseId,
    };

    try {
      await this.attemptModel.create({ ...key, correct });
      return true;
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }

      // The row exists. Promote it to correct if this answer was right; a wrong
      // re-answer matches nothing because of the `correct: false` clause.
      if (correct) {
        await this.attemptModel
          .updateOne({ ...key, correct: false }, { $set: { correct: true } })
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
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: number }).code;
  return code === DUPLICATE_KEY;
}