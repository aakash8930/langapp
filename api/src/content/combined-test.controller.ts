import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { AnswerCheckpointDto } from './dto/checkpoint-request.dto';
import { AnswerResult } from './dto/exercise-response.dto';
import { CombinedTestService, CombinedTestResult, CombinedTestSet } from './combined-test/combined-test.service';

/**
 * The end-of-course combined test — covers every unit the learner has
 * finished, in one timed set.
 *
 * Mounted as a sibling controller to `CheckpointController`, not as new
 * routes on it, for the same reason the per-unit test lives on its own
 * controller: the `unit` path parameter has no value here (the unit is
 * the *set* of finished units), and the request/response shape adds
 * `kind` and `unitSlugs`. A separate controller keeps the schemas honest.
 *
 * Like every other route in this build, these answer at the bare path and
 * under `/v1` — ADR-007, applied globally in `main.ts`.
 *
 * `POST` on start rather than `GET` because starting creates an attempt.
 * The attempt number comes back on the response; the client never chooses
 * one.
 */
@Controller('combined-test')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class CombinedTestController {
  constructor(private readonly combinedTestService: CombinedTestService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async start(@CurrentUser() user: AuthenticatedUser): Promise<CombinedTestSet> {
    return this.combinedTestService.start(user.userId);
  }

  @Post(':attempt/answer/:exerciseId')
  @HttpCode(HttpStatus.OK)
  async answer(
    @Param('attempt', ParseIntPipe) attempt: number,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: AnswerCheckpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnswerResult> {
    return this.combinedTestService.answer(attempt, exerciseId, user.userId, {
      optionId: dto.optionId,
      text: dto.text,
      responseTimeMs: dto.responseTimeMs,
    });
  }

  @Post(':attempt/submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('attempt', ParseIntPipe) attempt: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CombinedTestResult> {
    return this.combinedTestService.submit(attempt, user.userId);
  }
}
