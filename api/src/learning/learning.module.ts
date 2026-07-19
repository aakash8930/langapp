import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ContentModule } from '../content/content.module';
import { UserModule } from '../user/user.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { ProgressController } from './progress.controller';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { LessonCompletion, LessonCompletionSchema } from './schemas/lesson-completion.schema';
import { SrsCard, SrsCardSchema } from './schemas/srs-card.schema';

/**
 * Imports three modules for their exported services only. Learning owns
 * `srsCards` and `lessonCompletions`, and nothing else.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SrsCard.name, schema: SrsCardSchema },
      { name: LessonCompletion.name, schema: LessonCompletionSchema },
    ]),
    ContentModule,
    UserModule,
    AnalyticsModule,
  ],
  controllers: [LearningController, ProgressController, ReviewController],
  providers: [LearningService, ReviewService],
  exports: [LearningService, ReviewService],
})
export class LearningModule {}
