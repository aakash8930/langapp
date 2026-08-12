import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AnswerPracticeQuestionDto, CreatePracticeSessionDto } from './dto/practice.dto';
import { PracticeService } from './practice.service';

@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.practiceService.overview(user.userId);
  }

  @Post('sessions')
  create(
    @Body() dto: CreatePracticeSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.practiceService.create(user.userId, dto);
  }

  @Get('sessions/:sessionId')
  findOne(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.practiceService.findOne(user.userId, sessionId);
  }

  @Post('sessions/:sessionId/questions/:questionId/answer')
  @HttpCode(HttpStatus.OK)
  answer(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerPracticeQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.practiceService.answer(user.userId, sessionId, questionId, dto);
  }

  @Post('sessions/:sessionId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.practiceService.complete(user.userId, sessionId);
  }
}
