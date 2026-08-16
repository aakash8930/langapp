import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { ContentService } from './content.service';
import { FindLessonsDto } from './dto/find-lessons.dto';
import { LessonDetail, LessonSummary } from './dto/lesson-response.dto';
import { KanaCurriculumRow } from './dto/curriculum-response.dto';

/** Shared curriculum content, available after verification and personalization. */
@Controller('lessons')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class LessonController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  async findAll(@Query() query: FindLessonsDto): Promise<LessonSummary[]> {
    return this.contentService.findLessons(query.unit);
  }

  /**
   * Phase 0 — Data foundation. The ordered kana curriculum, including each
   * character's `taughtInLesson` attribution where the migration has stamped it.
   *
   * Lives under `/lessons` rather than `/kana` because every row in the
   * response carries a *lesson* provenance; "what's the next kana I'm going
   * to learn?" is a question about lessons, not characters.
   */
  @Get('curriculum')
  async findCurriculum(): Promise<KanaCurriculumRow[]> {
    return this.contentService.findKanaCurriculum();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LessonDetail> {
    return this.contentService.findLessonById(id);
  }
}
