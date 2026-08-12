import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiOrchestratorService, ChatTurn } from '../ai-orchestrator/ai-orchestrator.service';
import { DEFAULT_SCENARIO_ID } from '../ai-orchestrator/scenarios';
import { AnalyticsService } from '../analytics/analytics.service';
import { LearningService } from '../learning/learning.service';
import { ChatMessageResponse, ChatSessionListItem, ChatSessionResponse, ChatTurnResponse } from './dto/chat.dto';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionDocument } from './schemas/chat-session.schema';

/**
 * §8 cost guard: a session that has run this long has done its pedagogical
 * job — cap it rather than letting one session grow an unbounded prompt.
 */
export const CHAT_SESSION_MESSAGE_CAP = 50;

/**
 * Owns `chatSessions` and `chatMessages` (§4). The LLM turn itself lives in
 * AiOrchestratorService — this class is persistence, ownership checks, and
 * the §7 store step.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name) private readonly messageModel: Model<ChatMessageDocument>,
    private readonly orchestrator: AiOrchestratorService,
    private readonly analytics: AnalyticsService,
    // §7 step 7: corrections feed the SRS. The schema is owned by `learning`, so
    // this goes through its service and never near `srsCards` (§4).
    private readonly learning: LearningService,
  ) {}

  async createSession(userId: string, scenarioId?: string): Promise<ChatSessionResponse> {
    const scenario = this.orchestrator.requireScenario(scenarioId ?? DEFAULT_SCENARIO_ID);

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      scenario: scenario.id,
      startedAt: new Date(),
    });

    // Scripted opener from the scenario — zero tokens, deterministic, and the
    // learner gets a concrete question to answer instead of a blank screen.
    const opening = await this.messageModel.create({
      sessionId: session._id,
      role: 'assistant',
      text: scenario.opening,
      corrections: [],
      createdAt: new Date(),
    });

    return {
      id: session._id.toString(),
      scenario: scenario.id,
      title: scenario.title,
      titleJa: scenario.titleJa,
      startedAt: session.startedAt,
      messages: [toMessageResponse(opening)],
    };
  }

  async sendMessage(userId: string, sessionId: string, text: string): Promise<ChatTurnResponse> {
    const session = await this.findOwnedSession(userId, sessionId);

    const messageCount = await this.messageModel.countDocuments({ sessionId: session._id }).exec();
    if (messageCount >= CHAT_SESSION_MESSAGE_CAP) {
      throw new BadRequestException('This chat session is full — start a new one');
    }

    // §7 step 2 (retrieve): recent transcript, oldest first. The orchestrator
    // applies its own turn cap; loading a few extra rows here is harmless.
    const recent = await this.messageModel
      .find({ sessionId: session._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .exec();
    const history: ChatTurn[] = recent
      .reverse()
      .map((message) => ({ role: message.role, text: message.text }));

    // §7 steps 3–5: one provider call returns the reply and the corrections.
    const result = await this.orchestrator.converse(session.scenario, history, text);

    // §7 step 7 wants this on a queue; without BullMQ the writes are awaited
    // (two local inserts, ~ms) so the next turn's history is never missing a
    // message. Same trade AnalyticsService documents.
    const userMessage = await this.messageModel.create({
      sessionId: session._id,
      role: 'user',
      text,
      corrections: result.corrections,
      createdAt: new Date(),
    });
    const reply = await this.messageModel.create({
      sessionId: session._id,
      role: 'assistant',
      text: result.reply,
      corrections: [],
      createdAt: new Date(),
    });

    // §7 step 7 (T1.5): a corrected word becomes a review. Both halves of each
    // correction are searched — the learner's `span` often contains a correct
    // word used wrongly, and the `fix` is where the word reliably appears
    // spelled properly. Never throws, so a scheduling failure cannot cost the
    // learner the reply they just paid a provider call for.
    const scheduled = await this.learning.scheduleMissedWords(
      userId,
      result.corrections.flatMap((correction) => [correction.span, correction.fix]),
    );

    // Never throws (see AnalyticsService.record).
    await this.analytics.record({
      userId,
      type: 'chat.turn',
      payload: {
        sessionId: session._id.toString(),
        scenario: session.scenario,
        correctionCount: result.corrections.length,
        cardsCreated: scheduled.cardsCreated,
        cardsAdvanced: scheduled.cardsAdvanced,
      },
    });

    return {
      sessionId: session._id.toString(),
      corrections: userMessage.corrections,
      reply: toMessageResponse(reply),
    };
  }

  async listSessions(userId: string): Promise<ChatSessionListItem[]> {
    const sessions = await this.sessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ startedAt: -1 })
      .lean()
      .exec();

    const result: ChatSessionListItem[] = [];
    for (const s of sessions) {
      const scenario = this.orchestrator.requireScenario(s.scenario);
      const msgCount = await this.messageModel.countDocuments({ sessionId: s._id }).exec();
      const lastMsg = await this.messageModel
        .findOne({ sessionId: s._id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean()
        .exec();
      result.push({
        id: s._id.toString(),
        scenario: s.scenario,
        title: scenario.title,
        titleJa: scenario.titleJa,
        startedAt: s.startedAt,
        messageCount: msgCount,
        lastActivityAt: lastMsg?.createdAt ?? null,
      });
    }
    return result;
  }

  async getSession(userId: string, sessionId: string): Promise<ChatSessionResponse> {
    const session = await this.findOwnedSession(userId, sessionId);
    const scenario = this.orchestrator.requireScenario(session.scenario);
    const messages = await this.messageModel
      .find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return {
      id: session._id.toString(),
      scenario: session.scenario,
      title: scenario.title,
      titleJa: scenario.titleJa,
      startedAt: session.startedAt,
      messages: messages.map((m) => ({
        id: m._id.toString(),
        role: m.role,
        text: m.text,
        corrections: m.corrections,
        createdAt: m.createdAt,
      })),
    };
  }

  /** 404 for missing *and* for someone else's session — don't leak existence. */
  private async findOwnedSession(userId: string, sessionId: string): Promise<ChatSessionDocument> {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new NotFoundException('Chat session not found');
    }

    const session = await this.sessionModel
      .findOne({ _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId) })
      .exec();
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }

  /**
   * Account-deletion cascade (OPEN-ITEMS #5/#32).
   *
   * Deletes all chat sessions and their messages for the given user. Messages
   * are keyed by sessionId rather than userId, so the session ids are fetched
   * first, then both collections are wiped in parallel.
   *
   * Called by AccountDeletionService as part of the DELETE /me cascade.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const sessions = await this.sessionModel
      .find({ userId: userObjectId })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();

    const sessionIds = sessions.map((s) => s._id);

    await Promise.all([
      sessionIds.length > 0
        ? this.messageModel.deleteMany({ sessionId: { $in: sessionIds } }).exec()
        : Promise.resolve(),
      this.sessionModel.deleteMany({ userId: userObjectId }).exec(),
    ]);
  }
}

function toMessageResponse(message: ChatMessageDocument): ChatMessageResponse {
  return {
    id: message._id.toString(),
    role: message.role,
    text: message.text,
    corrections: message.corrections,
    createdAt: message.createdAt,
  };
}
