import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import {
  ChatSessionResponse,
  ChatTurnResponse,
  CreateChatSessionDto,
  SendChatMessageDto,
} from './dto/chat.dto';

/**
 * §10: rate limiting on chat is mandatory in Stage A — it's the only route
 * that spends provider quota per request, so the throttle is a cost guard as
 * much as an abuse guard. Uses the 'chat' throttler (CHAT_THROTTLE_*); the
 * 'auth' throttler is skipped so login limits don't count chat traffic.
 */
@Controller('chat')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@SkipThrottle({ auth: true })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  async createSession(
    @Body() dto: CreateChatSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatSessionResponse> {
    return this.chatService.createSession(user.userId, dto.scenario);
  }

  @Post('sessions/:id/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendChatMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatTurnResponse> {
    return this.chatService.sendMessage(user.userId, sessionId, dto.text);
  }
}
