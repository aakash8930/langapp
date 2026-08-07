import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  DailyStudySessionResponse,
  DueReviewsResponse,
  GradeReviewDto,
  GradeReviewResponse,
} from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('due')
  async due(@CurrentUser() user: AuthenticatedUser): Promise<DueReviewsResponse> {
    return this.reviewService.findDue(user.userId);
  }

  @Get('session')
  async session(@CurrentUser() user: AuthenticatedUser): Promise<DailyStudySessionResponse> {
    return this.reviewService.findDailySession(user.userId);
  }

  @Get('history')
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const d = days ? Math.min(90, Math.max(1, parseInt(days, 10) || 30)) : 30;
    return this.reviewService.getHistory(user.userId, d);
  }

  @Get('heatmap')
  async heatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const d = days ? Math.min(365, Math.max(7, parseInt(days, 10) || 84)) : 84;
    return this.reviewService.getHeatmap(user.userId, d);
  }

  @Get('forecast')
  async forecast(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.getForecast(user.userId);
  }

  @Post(':cardId/grade')
  @HttpCode(HttpStatus.OK)
  async grade(
    @Param('cardId') cardId: string,
    @Body() dto: GradeReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GradeReviewResponse> {
    return this.reviewService.grade(user.userId, cardId, dto.grade, dto.responseTimeMs);
  }
}
