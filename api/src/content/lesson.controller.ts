import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { FindLessonsDto } from './dto/find-lessons.dto';
import { LessonDetail, LessonSummary } from './dto/lesson-response.dto';
import { KanaCurriculumRow } from './dto/curriculum-response.dto';

/**
 * Unauthenticated on purpose — lessons are shared reference content with no
 * per-user state, and §9 lists them without an auth marker. See OPEN-ITEMS.md:
 * if Funnel scraping becomes a concern, adding JwtAuthGuard here is one line.
 */
@Controller('lessons')
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
