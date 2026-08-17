import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ContentModule } from '../content/content.module';
import { UserModule } from '../user/user.module';
import { CheckpointAttemptsService } from './checkpoint-attempts.service';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { LearnerItemStateService } from './learner-item-state.service';
import {
  LearnerItemState,
  LearnerItemStateSchema,
} from './schemas/learner-item-state.schema';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { ProgressController } from './progress.controller';
import {
  ExerciseAttempt,
  ExerciseAttemptSchema,
} from './schemas/exercise-attempt.schema';
import { LessonCompletion, LessonCompletionSchema } from './schemas/lesson-completion.schema';
import {
  UnitCheckpointAttempt,
  UnitCheckpointAttemptSchema,
} from './schemas/unit-checkpoint-attempt.schema';

/**
 * Imports three modules for their exported services only. Learning owns
 * `lessonCompletions`, `exerciseAttempts`, learner state, and checkpoints.
 *
 * `ContentModule` is wrapped in `forwardRef` because `ContentModule` exports
 * `ExerciseService`, which injects `ExerciseAttemptsService` from this module
 * to record exercise attempts. The dependency runs both ways at compile time
 * but only one way at runtime — the write is initiated by the exercise
 * endpoint, the read by the completion gate.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LessonCompletion.name, schema: LessonCompletionSchema },
      { name: ExerciseAttempt.name, schema: ExerciseAttemptSchema },
      { name: LearnerItemState.name, schema: LearnerItemStateSchema },
      { name: UnitCheckpointAttempt.name, schema: UnitCheckpointAttemptSchema },
    ]),
    forwardRef(() => ContentModule),
    UserModule,
    AnalyticsModule,
  ],
  controllers: [
    LearningController,
    ProgressController,
  ],
  providers: [
    LearningService,
    ExerciseAttemptsService,
    LearnerItemStateService,
    CheckpointAttemptsService,
  ],
  exports: [
    LearningService,
    ExerciseAttemptsService,
    // Exported for the backfill entrypoint (ADR-003) and, since the unit
    // checkpoint landed, for the weakness ranking that picks its questions.
    LearnerItemStateService,
    // The checkpoint's questions are generated in `content` (where the item
    // pools live) but recorded here, the same split `exerciseAttempts` has.
    CheckpointAttemptsService,
  ],
})
export class LearningModule {}
