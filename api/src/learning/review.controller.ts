import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { DueReviewsResponse, GradeReviewDto, GradeReviewResponse } from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('due')
  async due(@CurrentUser() user: AuthenticatedUser): Promise<DueReviewsResponse> {
    return this.reviewService.findDue(user.userId);
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
