import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AccountStateGuard } from '../common/auth/account-state.guard';
import { ReportUserDto, SearchUsersDto, SendMessageDto } from './dto/social.dto';
import { LeagueService } from './league.service';
import { SocialService } from './social.service';

/**
 * Friends, direct messages, blocking and reporting.
 *
 * Every route is behind `JwtAuthGuard` — there is no anonymous view of anything
 * here, unlike `/lessons`. The safety rules (friendship required to message, a
 * block in either direction disqualifying, the age minimum) all live in
 * `SocialService` rather than in these handlers, so a route added later cannot
 * skip them by forgetting a guard.
 */
@Controller('social')
@UseGuards(JwtAuthGuard, AccountStateGuard)
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly leagues: LeagueService,
  ) {}

  /**
   * This week's league table.
   *
   * Also the trigger for settling a week that has closed — there is no job
   * runner, so the first read after Monday does the work. That is why this can
   * be marginally slower than the rest; see `LeagueService.settleClosedWeeks`.
   */
  @Get('leaderboard')
  async leaderboard(@CurrentUser() current: AuthenticatedUser) {
    return this.leagues.leaderboard(current.userId);
  }

  /**
   * Search by display name.
   *
   * Throttled harder than the rest: this is the one route that reads across the
   * whole user base, so it is the one worth rate limiting against scraping. The
   * two-character floor and the 20-row cap are the other two brakes.
   */
  @Get('users')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async searchUsers(@CurrentUser() current: AuthenticatedUser, @Query() dto: SearchUsersDto) {
    return this.social.searchUsers(current.userId, dto.q);
  }

  @Get('friends')
  async friends(@CurrentUser() current: AuthenticatedUser) {
    return this.social.listFriends(current.userId);
  }

  @Get('friends/requests')
  async requests(@CurrentUser() current: AuthenticatedUser) {
    return this.social.listIncomingRequests(current.userId);
  }

  @Post('friends/requests/:userId')
  async sendRequest(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.social.sendFriendRequest(current.userId, userId);
  }

  @Post('friends/requests/:requestId/accept')
  async accept(
    @CurrentUser() current: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    return this.social.respondToRequest(current.userId, requestId, true);
  }

  @Post('friends/requests/:requestId/decline')
  async decline(
    @CurrentUser() current: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    return this.social.respondToRequest(current.userId, requestId, false);
  }

  @Delete('friends/:userId')
  async unfriend(@CurrentUser() current: AuthenticatedUser, @Param('userId') userId: string) {
    await this.social.removeFriend(current.userId, userId);
    return { removed: true };
  }

  @Get('messages/:userId')
  async messages(@CurrentUser() current: AuthenticatedUser, @Param('userId') userId: string) {
    return this.social.listMessages(current.userId, userId);
  }

  /**
   * Send a direct message.
   *
   * Throttled per user — a friendship is not a licence to flood someone, and the
   * block button should not be the only defence against volume.
   */
  @Post('messages/:userId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.social.sendMessage(current.userId, userId, dto.text);
  }

  @Get('blocks')
  async blocks(@CurrentUser() current: AuthenticatedUser) {
    return this.social.listBlocked(current.userId);
  }

  @Post('blocks/:userId')
  async block(@CurrentUser() current: AuthenticatedUser, @Param('userId') userId: string) {
    await this.social.blockUser(current.userId, userId);
    return { blocked: true };
  }

  @Delete('blocks/:userId')
  async unblock(@CurrentUser() current: AuthenticatedUser, @Param('userId') userId: string) {
    await this.social.unblockUser(current.userId, userId);
    return { blocked: false };
  }

  /**
   * File a report.
   *
   * Not throttled beyond the global limit. Someone being harassed may well fire
   * several of these in a row, and a rate limit that silently swallows the third
   * report is worse than a few duplicate rows.
   */
  @Post('reports')
  async report(@CurrentUser() current: AuthenticatedUser, @Body() dto: ReportUserDto) {
    return this.social.reportUser(
      current.userId,
      dto.userId,
      dto.reason,
      dto.note ?? '',
      dto.messageId,
    );
  }
}
