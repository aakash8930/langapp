import { api } from './client';

/** Mirrors the interfaces in api/src/chat/dto/chat.dto.ts. */

/** A correction of something the learner wrote. */
export type Correction = {
  /** The exact substring they typed. */
  span: string;
  /** The corrected Japanese. */
  fix: string;
  /** One short English sentence on why. */
  note: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /**
   * Only ever populated on `user` messages — the assistant's own reply is not
   * corrected. Server-side rule, restated here so nothing renders a correction
   * slot under a reply.
   */
  corrections: Correction[];
  /** ISO 8601 — JSON has no Date, whatever the server's DTO says. */
  createdAt: string;
};

export type ChatSession = {
  id: string;
  scenario: string;
  /** "First meeting" — English, for the screen title. */
  title: string;
  /** はじめまして — shown beside it. */
  titleJa: string;
  startedAt: string;
  /** Exactly one: the scripted opener. There is no history endpoint. */
  messages: ChatMessage[];
};

export type ChatTurn = {
  sessionId: string;
  /** Corrections of the message just sent, not of the reply. */
  corrections: Correction[];
  reply: ChatMessage;
};

/**
 * Costs no LLM tokens — the opening line is scripted server-side — so
 * abandoning a session and starting another is cheap.
 */
export function createChatSession(scenario?: string): Promise<ChatSession> {
  return api.post<ChatSession>('/chat/sessions', scenario ? { scenario } : {});
}

/**
 * One LLM call per send: the reply and the corrections come back together.
 * Seconds, not milliseconds — the screen must say it is working.
 */
export function sendChatMessage(sessionId: string, text: string): Promise<ChatTurn> {
  return api.post<ChatTurn>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    text,
  });
}
