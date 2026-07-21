import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AiOrchestratorService, ConverseResult } from '../ai-orchestrator/ai-orchestrator.service';
import { DEFAULT_SCENARIO_ID, findScenario } from '../ai-orchestrator/scenarios';
import { AnalyticsService } from '../analytics/analytics.service';
import { ChatService, CHAT_SESSION_MESSAGE_CAP } from './chat.service';
import { ChatMessageDocument } from './schemas/chat-message.schema';
import { ChatSessionDocument } from './schemas/chat-session.schema';

const USER_ID = '607f1f77bcf86cd799439011';
const SESSION_ID = '507f1f77bcf86cd799439022';

interface BuildOpts {
  session?: Partial<Record<string, unknown>> | null;
  messageCount?: number;
  recentMessages?: { role: 'user' | 'assistant'; text: string }[];
  converseResult?: ConverseResult;
}

function build(opts: BuildOpts = {}) {
  const session =
    opts.session === null
      ? null
      : ({
          _id: new Types.ObjectId(SESSION_ID),
          userId: new Types.ObjectId(USER_ID),
          scenario: DEFAULT_SCENARIO_ID,
          startedAt: new Date('2026-07-21T00:00:00Z'),
          ...opts.session,
        } as unknown as ChatSessionDocument);

  // Newest-first, the way the service queries them.
  const recentDesc = [...(opts.recentMessages ?? [])].reverse().map((m, i) => ({
    _id: new Types.ObjectId(),
    sessionId: new Types.ObjectId(SESSION_ID),
    role: m.role,
    text: m.text,
    corrections: [],
    createdAt: new Date(Date.now() - i * 1000),
  }));

  const sessionCreate = jest.fn((doc: Record<string, unknown>) =>
    Promise.resolve({ _id: new Types.ObjectId(SESSION_ID), ...doc } as unknown as ChatSessionDocument),
  );
  const messageCreate = jest.fn((doc: Record<string, unknown>) =>
    Promise.resolve({ _id: new Types.ObjectId(), ...doc } as unknown as ChatMessageDocument),
  );

  const sessionModel = {
    create: sessionCreate,
    findOne: jest.fn(() => ({ exec: () => Promise.resolve(session) })),
  };
  const messageModel = {
    create: messageCreate,
    countDocuments: () => ({ exec: () => Promise.resolve(opts.messageCount ?? 1) }),
    find: () => ({
      sort: () => ({ limit: () => ({ exec: () => Promise.resolve(recentDesc) }) }),
    }),
  };

  const converse = jest.fn(() =>
    Promise.resolve(opts.converseResult ?? { reply: 'いいですね！', corrections: [] }),
  );
  const requireScenario = jest.fn((id: string) => {
    const scenario = findScenario(id);
    if (!scenario) throw new BadRequestException(`Unknown chat scenario: ${id}`);
    return scenario;
  });
  const record = jest.fn(() => Promise.resolve());

  const service = new ChatService(
    sessionModel as never,
    messageModel as never,
    { converse, requireScenario } as unknown as AiOrchestratorService,
    { record } as unknown as AnalyticsService,
  );

  return { service, sessionCreate, messageCreate, sessionModel, converse, record };
}

describe('ChatService.createSession', () => {
  it('creates a session on the default scenario and persists the scripted opener', async () => {
    const { service, sessionCreate, messageCreate } = build();

    const result = await service.createSession(USER_ID);

    const scenario = findScenario(DEFAULT_SCENARIO_ID)!;
    expect(sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: DEFAULT_SCENARIO_ID }),
    );
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', text: scenario.opening, corrections: [] }),
    );
    expect(result.scenario).toBe(DEFAULT_SCENARIO_ID);
    expect(result.title).toBe(scenario.title);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[0].text).toBe(scenario.opening);
  });

  it('400s on an unknown scenario without touching the database', async () => {
    const { service, sessionCreate } = build();

    await expect(service.createSession(USER_ID, 'no-such-scene')).rejects.toThrow(
      BadRequestException,
    );
    expect(sessionCreate).not.toHaveBeenCalled();
  });
});

describe('ChatService.sendMessage — guards', () => {
  it('404s when the session does not exist', async () => {
    const { service } = build({ session: null });

    await expect(service.sendMessage(USER_ID, SESSION_ID, 'hi')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("scopes the lookup to the caller, so someone else's session 404s", async () => {
    const { service, sessionModel } = build();

    await service.sendMessage(USER_ID, SESSION_ID, 'hi');

    expect(sessionModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(SESSION_ID),
      userId: new Types.ObjectId(USER_ID),
    });
  });

  it('404s on a malformed session id instead of throwing a cast error', async () => {
    const { service } = build();

    await expect(service.sendMessage(USER_ID, 'not-an-objectid', 'hi')).rejects.toThrow(
      NotFoundException,
    );
  });

  it(`400s once a session holds ${CHAT_SESSION_MESSAGE_CAP} messages (§8 cost guard)`, async () => {
    const { service, converse } = build({ messageCount: CHAT_SESSION_MESSAGE_CAP });

    await expect(service.sendMessage(USER_ID, SESSION_ID, 'hi')).rejects.toThrow(
      BadRequestException,
    );
    expect(converse).not.toHaveBeenCalled();
  });
});

describe('ChatService.sendMessage — the turn', () => {
  it('hands the orchestrator the transcript oldest-first plus the new text', async () => {
    const { service, converse } = build({
      recentMessages: [
        { role: 'assistant', text: 'こんにちは！' },
        { role: 'user', text: 'konnichiwa' },
      ],
    });

    await service.sendMessage(USER_ID, SESSION_ID, 'watashi wa Aakash desu');

    expect(converse).toHaveBeenCalledWith(
      DEFAULT_SCENARIO_ID,
      [
        { role: 'assistant', text: 'こんにちは！' },
        { role: 'user', text: 'konnichiwa' },
      ],
      'watashi wa Aakash desu',
    );
  });

  it('stores corrections on the user message and none on the reply', async () => {
    const corrections = [{ span: 'ha', fix: 'は', note: 'Topic particle.' }];
    const { service, messageCreate } = build({
      converseResult: { reply: 'いいなまえですね！', corrections },
    });

    const result = await service.sendMessage(USER_ID, SESSION_ID, 'watashi ha Aakash desu');

    expect(messageCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: 'user', text: 'watashi ha Aakash desu', corrections }),
    );
    expect(messageCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: 'assistant', text: 'いいなまえですね！', corrections: [] }),
    );
    expect(result.corrections).toEqual(corrections);
    expect(result.reply.text).toBe('いいなまえですね！');
    expect(result.sessionId).toBe(SESSION_ID);
  });

  it("emits a 'chat.turn' analytics event (§7 step 7)", async () => {
    const { service, record } = build({
      converseResult: { reply: 'ok', corrections: [{ span: 'a', fix: 'b', note: 'c' }] },
    });

    await service.sendMessage(USER_ID, SESSION_ID, 'hi');

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      type: 'chat.turn',
      payload: expect.objectContaining({
        sessionId: SESSION_ID,
        scenario: DEFAULT_SCENARIO_ID,
        correctionCount: 1,
      }),
    });
  });

  it('persists nothing when the provider call fails — no half-written turns', async () => {
    const { service, messageCreate, converse } = build();
    converse.mockRejectedValue(new Error('provider down'));

    await expect(service.sendMessage(USER_ID, SESSION_ID, 'hi')).rejects.toThrow('provider down');
    expect(messageCreate).not.toHaveBeenCalled();
  });
});
