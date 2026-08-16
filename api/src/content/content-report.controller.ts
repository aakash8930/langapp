import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { ContentService } from './content.service';
import { ReportMistakeDto } from './dto/report-mistake.dto';

/**
 * OPEN-ITEMS #8: "Report a mistake" affordance.
 * Authenticated route allowing learners to report errors on content items or lessons.
 */
@Controller('content')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class ContentReportController {
  constructor(private readonly contentService: ContentService) {}

  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  async reportMistake(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ReportMistakeDto,
  ): Promise<{ id: string; status: string }> {
    return this.contentService.reportMistake(current.userId, dto);
  }
}
