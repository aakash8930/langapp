import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentModule } from '../content/content.module';
import { LearningModule } from '../learning/learning.module';
import { UserModule } from '../user/user.module';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { PracticeSession, PracticeSessionSchema } from './schemas/practice-session.schema';

/**
 * Practice orchestrates Content's question engine and Learning's confidence
 * evidence while owning its session/result documents. It depends on both, but
 * neither depends on Practice, so the existing Content↔Learning cycle does not
 * gain another edge.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PracticeSession.name, schema: PracticeSessionSchema },
    ]),
    ContentModule,
    LearningModule,
    UserModule,
  ],
  controllers: [PracticeController],
  providers: [PracticeService],
  exports: [PracticeService],
})
export class PracticeModule {}
