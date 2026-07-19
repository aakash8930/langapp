import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CompleteLessonResponse } from './dto/complete-lesson-response.dto';
import { LearningService } from './learning.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Post(':lessonId/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompleteLessonResponse> {
    return this.learningService.completeLesson(user.userId, lessonId);
  }
}
