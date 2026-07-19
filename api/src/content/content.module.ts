import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentService } from './content.service';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise/exercise.service';
import { LessonController } from './lesson.controller';
import { GrammarPoint, GrammarPointSchema } from './schemas/grammar-point.schema';
import { KanaItem, KanaItemSchema } from './schemas/kana-item.schema';
import { KanjiEntry, KanjiEntrySchema } from './schemas/kanji-entry.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { VocabItem, VocabItemSchema } from './schemas/vocab-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: KanaItem.name, schema: KanaItemSchema },
      { name: VocabItem.name, schema: VocabItemSchema },
      { name: GrammarPoint.name, schema: GrammarPointSchema },
      { name: KanjiEntry.name, schema: KanjiEntrySchema },
    ]),
  ],
  controllers: [LessonController, ExerciseController],
  providers: [ContentService, ExerciseService],
  exports: [ContentService, ExerciseService],
})
export class ContentModule {}
