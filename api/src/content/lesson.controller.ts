import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { FindLessonsDto } from './dto/find-lessons.dto';
import { LessonDetail, LessonSummary } from './dto/lesson-response.dto';

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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LessonDetail> {
    return this.contentService.findLessonById(id);
  }
}
