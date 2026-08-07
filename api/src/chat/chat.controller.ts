import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import {
  ChatSessionListItem,
  ChatSessionResponse,
  ChatTurnResponse,
  CreateChatSessionDto,
  SendChatMessageDto,
} from './dto/chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@SkipThrottle({ auth: true })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<ChatSessionListItem[]> {
    return this.chatService.listSessions(user.userId);
  }

  @Get('sessions/:id')
  async getSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChatSessionResponse> {
    return this.chatService.getSession(user.userId, sessionId);
  }

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
