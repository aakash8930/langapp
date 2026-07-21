import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiOrchestratorService, ChatTurn, HISTORY_TURN_CAP } from './ai-orchestrator.service';
import { GeminiProvider, GenerateJsonInput } from './gemini.provider';
import { DEFAULT_SCENARIO_ID, findScenario } from './scenarios';

function build(providerResult: unknown = { reply: 'はい！', corrections: [] }) {
  const generateJson = jest.fn((_input: GenerateJsonInput) => Promise.resolve(providerResult));
  const service = new AiOrchestratorService({ generateJson } as unknown as GeminiProvider);
  return { service, generateJson };
}

describe('AiOrchestratorService.requireScenario', () => {
  it('returns the default scenario', () => {
    const { service } = build();
    expect(service.requireScenario(DEFAULT_SCENARIO_ID).id).toBe(DEFAULT_SCENARIO_ID);
  });

  it('400s on an unknown scenario id', () => {
    const { service } = build();
    expect(() => service.requireScenario('marathon-training')).toThrow(BadRequestException);
  });
});

describe('AiOrchestratorService.converse — prompt assembly', () => {
  it('puts the scene and every target word into the system prompt', async () => {
    const { service, generateJson } = build();

    await service.converse(DEFAULT_SCENARIO_ID, [], 'hello');

    const input = generateJson.mock.calls[0][0];
    const scenario = findScenario(DEFAULT_SCENARIO_ID)!;
    expect(input.system).toContain(scenario.setting);
    for (const word of scenario.targetWords) {
      expect(input.system).toContain(word.lemma);
    }
  });

  it('maps roles (assistant→model) and appends the new user text last', async () => {
    const { service, generateJson } = build();
    const history: ChatTurn[] = [
      { role: 'assistant', text: 'こんにちは' },
      { role: 'user', text: 'konnichiwa!' },
    ];

    await service.converse(DEFAULT_SCENARIO_ID, history, 'watashi wa Aakash desu');

    expect(generateJson.mock.calls[0][0].turns).toEqual([
      { role: 'model', text: 'こんにちは' },
      { role: 'user', text: 'konnichiwa!' },
      { role: 'user', text: 'watashi wa Aakash desu' },
    ]);
  });

  it(`caps history at the last ${HISTORY_TURN_CAP} turns (§8: input tokens are the cost you control)`, async () => {
    const { service, generateJson } = build();
    const history: ChatTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'assistant' : 'user',
      text: `turn-${i}`,
    }));

    await service.converse(DEFAULT_SCENARIO_ID, history, 'latest');

    const turns = generateJson.mock.calls[0][0].turns;
    expect(turns).toHaveLength(HISTORY_TURN_CAP + 1);
    expect(turns[0].text).toBe(`turn-${30 - HISTORY_TURN_CAP}`); // oldest kept
    expect(turns[turns.length - 1]).toEqual({ role: 'user', text: 'latest' });
  });
});

describe('AiOrchestratorService.converse — output validation', () => {
  it('passes a well-formed reply and corrections through', async () => {
    const { service } = build({
      reply: 'いいですね！',
      corrections: [{ span: 'watashi ha', fix: 'わたしは', note: 'The topic particle is pronounced "wa".' }],
    });

    const result = await service.converse(DEFAULT_SCENARIO_ID, [], 'watashi ha Aakash desu');

    expect(result.reply).toBe('いいですね！');
    expect(result.corrections).toEqual([
      { span: 'watashi ha', fix: 'わたしは', note: 'The topic particle is pronounced "wa".' },
    ]);
  });

  it('drops malformed correction entries instead of failing the turn', async () => {
    const { service } = build({
      reply: 'ok',
      corrections: [
        { span: 'a', fix: 'b', note: 'c' },
        { span: 42, fix: 'missing note' },
        'not even an object',
      ],
    });

    const result = await service.converse(DEFAULT_SCENARIO_ID, [], 'x');
    expect(result.corrections).toEqual([{ span: 'a', fix: 'b', note: 'c' }]);
  });

  it('treats a non-array corrections field as no corrections', async () => {
    const { service } = build({ reply: 'ok', corrections: 'none' });

    const result = await service.converse(DEFAULT_SCENARIO_ID, [], 'x');
    expect(result.corrections).toEqual([]);
  });

  it('caps runaway correction lists at 10', async () => {
    const { service } = build({
      reply: 'ok',
      corrections: Array.from({ length: 25 }, (_, i) => ({ span: `s${i}`, fix: 'f', note: 'n' })),
    });

    const result = await service.converse(DEFAULT_SCENARIO_ID, [], 'x');
    expect(result.corrections).toHaveLength(10);
  });

  it('502s when the model returns no usable reply', async () => {
    const { service } = build({ reply: '   ', corrections: [] });

    await expect(service.converse(DEFAULT_SCENARIO_ID, [], 'x')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
