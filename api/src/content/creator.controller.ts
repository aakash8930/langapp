import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CreatorGuard } from '../common/auth/creator.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { CreateLessonDto, CreateVocabDto } from './dto/creator.dto';
import { ItemRef } from './schemas/lesson.schema';

@Controller('creator')
@UseGuards(JwtAuthGuard, AccountStateGuard, CreatorGuard)
export class CreatorController {
  constructor(private readonly contentService: ContentService) {}

  @Post('lessons')
  async createLesson(@Body() dto: CreateLessonDto) {
    const itemRefs: ItemRef[] = dto.itemRefs.map(r => ({
      kind: r.kind,
      id: new Types.ObjectId(r.id),
    }));
    
    const prerequisiteLessonIds = dto.prerequisiteLessonIds.map(id => new Types.ObjectId(id));

    const lesson = await this.contentService.upsertLesson({
      unit: dto.unit,
      order: dto.order,
      title: dto.title,
      itemRefs,
      exerciseTypes: dto.exerciseTypes,
      prerequisiteLessonIds,
    });

    return { id: lesson._id.toString(), status: 'success' };
  }

  @Post('vocab')
  async createVocab(@Body() dto: CreateVocabDto) {
    const vocab = await this.contentService.upsertVocab({
      lemma: dto.lemma,
      reading: dto.reading,
      romaji: dto.romaji,
      gloss: dto.gloss,
      pos: dto.pos,
      jlpt: dto.jlpt || 'N5',
      tags: dto.tags,
    });
    
    return { id: vocab._id.toString(), status: 'success' };
  }
}
