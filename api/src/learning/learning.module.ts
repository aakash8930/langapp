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
import { LearningEngineController } from './learning-engine.controller';
import { LearningEngineService } from './learning-engine.service';
import { ProgressController } from './progress.controller';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import {
  ExerciseAttempt,
  ExerciseAttemptSchema,
} from './schemas/exercise-attempt.schema';
import { LessonCompletion, LessonCompletionSchema } from './schemas/lesson-completion.schema';
import { SrsCard, SrsCardSchema } from './schemas/srs-card.schema';
import { DailyStudySession, DailyStudySessionSchema } from './schemas/daily-study-session.schema';
import {
  UnitCheckpointAttempt,
  UnitCheckpointAttemptSchema,
} from './schemas/unit-checkpoint-attempt.schema';

/**
 * Imports three modules for their exported services only. Learning owns
 * `srsCards`, `lessonCompletions` and `exerciseAttempts`, and nothing else.
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
      { name: SrsCard.name, schema: SrsCardSchema },
      { name: DailyStudySession.name, schema: DailyStudySessionSchema },
      { name: LessonCompletion.name, schema: LessonCompletionSchema },
      { name: ExerciseAttempt.name, schema: ExerciseAttemptSchema },
      { name: LearnerItemState.name, schema: LearnerItemStateSchema },
      { name: UnitCheckpointAttempt.name, schema: UnitCheckpointAttemptSchema },
    ]),
    forwardRef(() => ContentModule),
    UserModule,
    AnalyticsModule,
    // No KnowledgeGraphModule: `LearningEngineService` was injecting
    // `KnowledgeGraphService` to call `findPrerequisites` and discard the result
    // (ADR-005). The import goes with the call rather than being kept warm for a
    // future slice — an unused module edge reads as a real dependency, and this
    // is a modular monolith where those edges are the architecture. Slice 3 adds
    // it back at the point something reads concept prerequisites.
  ],
  controllers: [
    LearningController,
    ProgressController,
    ReviewController,
    LearningEngineController,
  ],
  providers: [
    LearningService,
    ReviewService,
    ExerciseAttemptsService,
    LearningEngineService,
    LearnerItemStateService,
    CheckpointAttemptsService,
  ],
  exports: [
    LearningService,
    ReviewService,
    ExerciseAttemptsService,
    LearningEngineService,
    // Exported for the backfill entrypoint (ADR-003) and, since the unit
    // checkpoint landed, for the weakness ranking that picks its questions.
    LearnerItemStateService,
    // The checkpoint's questions are generated in `content` (where the item
    // pools live) but recorded here, the same split `exerciseAttempts` has.
    CheckpointAttemptsService,
  ],
})
export class LearningModule {}
