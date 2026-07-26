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
   * Write one attempt. Re-answering the same (user, lesson, attempt, exercise)
   * is a no-op — the unique index makes that structural, the catch below
   * keeps the write from throwing. Returns `true` when a new row was created,
   * `false` when the attempt already existed.
   *
   * The write is `insertMany` with `ordered: false` so a duplicate doesn't
   * abort the rest of a batch — same shape as `seedCards` in
   * `learning.service.ts`, mirroring the established pattern.
   */
  async recordAttempt(
    userId: string,
    lessonId: string,
    attempt: number,
    exerciseId: string,
    correct: boolean,
  ): Promise<boolean> {
    try {
      await this.attemptModel.create({
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
        attempt,
        exerciseId,
        correct,
      });
      return true;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return false;
      }
      throw err;
    }
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