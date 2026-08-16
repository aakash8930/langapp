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
import { CheckpointService } from './checkpoint/checkpoint.service';
import { AnswerCheckpointDto } from './dto/checkpoint-request.dto';
import { CheckpointResult, CheckpointSet } from './dto/checkpoint-response.dto';
import { AnswerResult } from './dto/exercise-response.dto';

/**
 * The end-of-unit checkpoint.
 *
 * A new controller rather than routes added to `ExerciseController`, which is
 * also what makes the versioning work: every route here answers at its bare
 * path and under `/v1` automatically (ADR-007). Adding a `version` to an
 * *existing* route is the thing that would break installed clients.
 *
 * `POST` on start rather than `GET` because starting a checkpoint creates an
 * attempt — it is not a safe, cacheable read, and issuing the attempt number
 * server-side is the point.
 */
@Controller('units/:unit/checkpoint')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class CheckpointController {
  constructor(private readonly checkpointService: CheckpointService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async start(
    @Param('unit') unit: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckpointSet> {
    return this.checkpointService.start(unit, user.userId);
  }

  @Post(':attempt/answer/:exerciseId')
  @HttpCode(HttpStatus.OK)
  async answer(
    @Param('unit') unit: string,
    @Param('attempt', ParseIntPipe) attempt: number,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: AnswerCheckpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnswerResult> {
    // Every field is forwarded explicitly. `responseTimeMs` was dropped this
    // way on the exercise route for its whole life (OPEN-ITEMS #38) — the DTO
    // validated it, the service threaded it, and a re-built body in the
    // controller silently discarded it.
    return this.checkpointService.answer(unit, attempt, exerciseId, user.userId, {
      optionId: dto.optionId,
      text: dto.text,
      responseTimeMs: dto.responseTimeMs,
    });
  }

  @Post(':attempt/submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('unit') unit: string,
    @Param('attempt', ParseIntPipe) attempt: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckpointResult> {
    return this.checkpointService.submit(unit, attempt, user.userId);
  }
}
