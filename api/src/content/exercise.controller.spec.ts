import { AuthenticatedUser } from '../common/auth/jwt-auth.guard';
import { AnswerExerciseDto } from './dto/exercise-request.dto';
import { AnswerResult } from './dto/exercise-response.dto';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise/exercise.service';

const LESSON_ID = '507f1f77bcf86cd799439011';
const EXERCISE_ID = '0:0';
const USER: AuthenticatedUser = {
  userId: '607f1f77bcf86cd799439011',
} as AuthenticatedUser;

/**
 * The controller re-builds the answer body field by field rather than passing
 * the DTO through, which is what makes these tests worth having: a field added
 * to the DTO and to the service but not to *this* object is accepted by the
 * validator, typechecks, and is then silently discarded.
 *
 * That is not hypothetical — `responseTimeMs` was dropped exactly this way from
 * the day it was added until 2026-07-29. Nothing failed: the DTO validated it,
 * `ExerciseAttempt` had a column for it, `LearnerItemState` had Welford stats
 * waiting for it, and every row stored `null`.
 */
describe('ExerciseController.answer — body forwarding', () => {
  function build() {
    const answer = jest.fn(() =>
      Promise.resolve({ exerciseId: EXERCISE_ID, correct: true } as unknown as AnswerResult),
    );
    const controller = new ExerciseController({ answer } as unknown as ExerciseService);
    return { controller, answer };
  }

  it('forwards responseTimeMs to the service', async () => {
    const { controller, answer } = build();
    const dto: AnswerExerciseDto = { optionId: 'opt-0', responseTimeMs: 4200 };

    await controller.answer(LESSON_ID, EXERCISE_ID, dto, USER);

    expect(answer).toHaveBeenCalledWith(LESSON_ID, EXERCISE_ID, USER.userId, {
      optionId: 'opt-0',
      text: undefined,
      responseTimeMs: 4200,
    });
  });

  it('forwards a typed wordReading answer with its response time', async () => {
    const { controller, answer } = build();
    const dto: AnswerExerciseDto = { text: 'gakkou', responseTimeMs: 9100 };

    await controller.answer(LESSON_ID, EXERCISE_ID, dto, USER);

    expect(answer).toHaveBeenCalledWith(LESSON_ID, EXERCISE_ID, USER.userId, {
      optionId: undefined,
      text: 'gakkou',
      responseTimeMs: 9100,
    });
  });

  it('leaves responseTimeMs undefined when the client omits it', async () => {
    // Optional on the wire, and both clients omit it today. `undefined` must
    // reach the service as `undefined` rather than 0 — a zero would be a real
    // sample of an impossibly fast answer and would poison the mean.
    const { controller, answer } = build();
    const dto: AnswerExerciseDto = { optionId: 'opt-1' };

    await controller.answer(LESSON_ID, EXERCISE_ID, dto, USER);

    expect(answer).toHaveBeenCalledWith(LESSON_ID, EXERCISE_ID, USER.userId, {
      optionId: 'opt-1',
      text: undefined,
      responseTimeMs: undefined,
    });
  });
});
