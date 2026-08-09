import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LearningModule } from '../learning/learning.module';
import { UserModule } from '../user/user.module';
import { StorageModule } from '../common/storage/storage.module';
import { AudioController } from './audio.controller';
import { StrokesController } from './strokes.controller';
import { CombinedTestController } from './combined-test.controller';
import { CombinedTestService } from './combined-test/combined-test.service';
import { ContentService } from './content.service';
import { CheckpointController } from './checkpoint.controller';
import { UnitController } from './unit.controller';
import { CheckpointService } from './checkpoint/checkpoint.service';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise/exercise.service';
import { LessonController } from './lesson.controller';
import { VocabController } from './vocab.controller';
import { GrammarController } from './grammar.controller';
import { GrammarPoint, GrammarPointSchema } from './schemas/grammar-point.schema';
import { KanaItem, KanaItemSchema } from './schemas/kana-item.schema';
import { KanjiEntry, KanjiEntrySchema } from './schemas/kanji-entry.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { VocabItem, VocabItemSchema } from './schemas/vocab-item.schema';
import { ContentReport, ContentReportSchema } from './schemas/content-report.schema';
import { ContentReportController } from './content-report.controller';
import { Course, CourseSchema } from './schemas/course.schema';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { ContentVersion, ContentVersionSchema } from './schemas/content-version.schema';
import { ExercisePluginRegistry } from './exercise/plugins/exercise-plugin.registry';
import { MultipleChoicePlugin } from './exercise/plugins/multiple-choice.plugin';
import { WordReadingPlugin } from './exercise/plugins/word-reading.plugin';
import { ListeningPlugin } from './exercise/plugins/listening.plugin';
import { SentenceBuildingPlugin } from './exercise/plugins/sentence-building.plugin';
import { FillInTheBlankPlugin } from './exercise/plugins/fill-in-the-blank.plugin';
import { FlashcardPlugin } from './exercise/plugins/flashcard.plugin';
import { SpeechPlugin } from './exercise/plugins/speech.plugin';

import { CreatorController } from './creator.controller';

/**
 * `LearningModule` is wrapped in `forwardRef` because `ExerciseService` (in
 * this module) injects `ExerciseAttemptsService` from learning to record
 * answered exercises. The cross-module write is the natural call site: the
 * answer endpoint already has the user / lesson / attempt / exercise / correct
 * data, and the completion gate (in `LearningService`) reads it back. The
 * other side of the cycle is also `forwardRef`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: KanaItem.name, schema: KanaItemSchema },
      { name: VocabItem.name, schema: VocabItemSchema },
      { name: GrammarPoint.name, schema: GrammarPointSchema },
      { name: KanjiEntry.name, schema: KanjiEntrySchema },
      { name: ContentReport.name, schema: ContentReportSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Quiz.name, schema: QuizSchema },
      { name: ContentVersion.name, schema: ContentVersionSchema },
    ]),
    forwardRef(() => LearningModule),
    // Back after being removed. It was here so `ExerciseService` could charge
    // a heart for a wrong answer, and went out with hearts in Phase 2 §3.1 —
    // the note then was that an edge outliving its reason misleads the next
    // reader. `CheckpointService` gives it a new and real reason: passing a
    // unit awards XP, and only `UserService` writes that.
    UserModule,
    // Audio bytes live behind StorageService, never `fs` directly.
    StorageModule,
  ],
  controllers: [
    LessonController,
    UnitController,
    VocabController,
    GrammarController,
    ExerciseController,
    CheckpointController,
    CombinedTestController,
    AudioController,
    StrokesController,
    ContentReportController,
    CreatorController,
  ],
  providers: [
    ContentService,
    ExerciseService,
    CheckpointService,
    CombinedTestService,
    ExercisePluginRegistry,
    MultipleChoicePlugin,
    WordReadingPlugin,
    ListeningPlugin,
    SentenceBuildingPlugin,
    FillInTheBlankPlugin,
    FlashcardPlugin,
    SpeechPlugin,
  ],
  exports: [ContentService, ExerciseService, CheckpointService, CombinedTestService, ExercisePluginRegistry],
})
export class ContentModule {}
