import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  LearningEngineService,
  MemoryModelResponse,
  ReadinessResponse,
  ReviewAnalyticsResponse,
} from './learning-engine.service';

/**
 * Controller serving Adaptive Learner Model APIs:
 * - Readiness score per lesson
 * - Personal memory model & forgetting curve visualization data
 * - Review & exercise session analytics
 */
@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningEngineController {
  constructor(private readonly engineService: LearningEngineService) {}

  @Get('readiness/:lessonId')
  async getReadiness(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReadinessResponse> {
    return this.engineService.getReadiness(user.userId, lessonId);
  }

  @Get('memory-model')
  async getMemoryModel(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryModelResponse> {
    return this.engineService.getMemoryModel(user.userId);
  }

  @Get('analytics')
  async getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewAnalyticsResponse> {
    return this.engineService.getReviewAnalytics(user.userId);
  }
}
