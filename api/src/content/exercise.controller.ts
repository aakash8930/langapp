import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { AnswerExerciseDto, FindExercisesDto } from './dto/exercise-request.dto';
import { AnswerResult, ExerciseSet } from './dto/exercise-response.dto';
import { ExerciseService } from './exercise/exercise.service';

/**
 * Guarded, unlike the plain /lessons reads: generation is seeded per user, so
 * these routes need an identity to be deterministic at all.
 */
@Controller('lessons/:lessonId/exercises')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Get()
  async generate(
    @Param('lessonId') lessonId: string,
    @Query() query: FindExercisesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExerciseSet> {
    return this.exerciseService.generate(lessonId, user.userId, query.attempt);
  }

  @Post(':exerciseId/answer')
  @HttpCode(HttpStatus.OK)
  async answer(
    @Param('lessonId') lessonId: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: AnswerExerciseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnswerResult> {
    // The DTO is a discriminated union of { optionId } and { text }; pass
    // whichever was provided and let the service decide which one matches
    // the lesson's exercise type.
    //
    // `responseTimeMs` has to be forwarded explicitly, and was not until
    // 2026-07-29: this re-built object silently dropped it, so every
    // `ExerciseAttempt.responseTimeMs` stored `null` and the Welford stats on
    // `LearnerItemState` never took a sample. The speed term is a quarter of
    // `computeConfidence`, so the whole of it was dead weight on lesson
    // answers while the DTO, the service and the schema all supported it.
    return this.exerciseService.answer(lessonId, exerciseId, user.userId, {
      optionId: dto.optionId,
      text: dto.text,
      responseTimeMs: dto.responseTimeMs,
    });
  }
}
