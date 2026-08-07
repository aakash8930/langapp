import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Correction } from '../../ai-orchestrator/ai-orchestrator.service';

export class CreateChatSessionDto {
  /** Defaults to the registry's default scenario when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  scenario?: string;
}

export class SendChatMessageDto {
  /** 500 chars is a cost guard (§8), not a UX limit — beginners write short. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;
}

export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  corrections: Correction[];
  createdAt: Date;
}

export interface ChatSessionResponse {
  id: string;
  scenario: string;
  title: string;
  titleJa: string;
  startedAt: Date;
  /** The scripted opening line, so the client has something to render. */
  messages: ChatMessageResponse[];
}

export interface ChatTurnResponse {
  sessionId: string;
  /** Corrections of the message the learner just sent. */
  corrections: Correction[];
  reply: ChatMessageResponse;
}

export interface ChatSessionListItem {
  id: string;
  scenario: string;
  title: string;
  titleJa: string;
  startedAt: Date;
  messageCount: number;
  lastActivityAt: Date | null;
}
