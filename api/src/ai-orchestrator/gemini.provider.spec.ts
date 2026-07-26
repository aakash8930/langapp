import {
  BadGatewayException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

const SCHEMA = { type: 'OBJECT' };

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
}

/** A minimal successful generateContent body whose answer is `payload`. */
function geminiOk(payload: unknown, extraParts: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        candidates: [
          {
            content: { parts: [...extraParts, { text: JSON.stringify(payload) }] },
            finishReason: 'STOP',
          },
        ],
      }),
  } as unknown as Response;
}

describe('GeminiProvider.generateJson', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  function call(provider: GeminiProvider) {
    return provider.generateJson({
      system: 'be a tutor',
      turns: [
        { role: 'model', text: 'konnichiwa' },
        { role: 'user', text: 'hello' },
      ],
      responseSchema: SCHEMA,
    });
  }

  it('503s without ever calling Google when no key is configured', async () => {
    const provider = new GeminiProvider(makeConfig({ GEMINI_API_KEY: '' }));

    await expect(call(provider)).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the key in a header, the model in the path, and the prompt in the body', async () => {
    fetchMock.mockResolvedValue(geminiOk({ reply: 'ok' }));
    const provider = new GeminiProvider(makeConfig());

    await call(provider);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    );
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    // The key must never ride in the URL, where it would land in logs.
    expect(url).not.toContain('test-key');

    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('be a tutor');
    expect(body.contents).toEqual([
      { role: 'model', parts: [{ text: 'konnichiwa' }] },
      { role: 'user', parts: [{ text: 'hello' }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual(SCHEMA);
  });

  it('returns the parsed JSON payload', async () => {
    fetchMock.mockResolvedValue(geminiOk({ reply: 'こんにちは', corrections: [] }));
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).resolves.toEqual({ reply: 'こんにちは', corrections: [] });
  });

  it('skips thought parts from thinking models', async () => {
    fetchMock.mockResolvedValue(
      geminiOk({ reply: 'answer' }, [{ text: 'internal reasoning', thought: true }]),
    );
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).resolves.toEqual({ reply: 'answer' });
  });

  it('surfaces the provider rate limit as a 429', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as unknown as Response);
    const provider = new GeminiProvider(makeConfig());

    const error = await call(provider).catch((err: HttpException) => err);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
  });

  it('maps provider 5xx to 502', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    } as unknown as Response);
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).rejects.toThrow(BadGatewayException);
  });

  it('maps network failure to 502', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'));
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).rejects.toThrow(BadGatewayException);
  });

  it('maps a safety-blocked (no candidate) response to 502', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ promptFeedback: { blockReason: 'SAFETY' } }),
    } as unknown as Response);
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).rejects.toThrow(BadGatewayException);
  });

  it('maps a MAX_TOKENS truncation to 502 rather than returning half a JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            { content: { parts: [{ text: '{"reply": "unfini' }] }, finishReason: 'MAX_TOKENS' },
          ],
        }),
    } as unknown as Response);
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).rejects.toThrow(BadGatewayException);
  });

  it('maps non-JSON output to 502', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'plain prose' }] }, finishReason: 'STOP' }],
        }),
    } as unknown as Response);
    const provider = new GeminiProvider(makeConfig());

    await expect(call(provider)).rejects.toThrow(BadGatewayException);
  });

  describe('provider 503 retry (OPEN-ITEMS #28)', () => {
    beforeEach(() => {
      // Backoff in the provider is real `setTimeout`. Use fake timers so the
      // tests don't actually sleep 3 seconds, and assert against the call
      // count rather than wall-clock time.
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('retries a 503, then succeeds, and returns the model answer', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response)
        .mockResolvedValueOnce(geminiOk({ reply: 'after one retry' }));

      const provider = new GeminiProvider(makeConfig());
      const promise = call(provider);

      // Drain the scheduled backoff.
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(promise).resolves.toEqual({ reply: 'after one retry' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a 503 up to MAX_ATTEMPTS times, then surfaces 502', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('unavailable'),
      } as unknown as Response);

      const provider = new GeminiProvider(makeConfig());
      // Attach the rejection handler up front so the rejection is never
      // observed as unhandled while the timer-driven microtasks unfold.
      const promise = call(provider).catch((err: unknown) => err);

      // Drive both backoffs (1s, then 2s) and flush microtasks between them
      // so the next `await fetch()` runs and the loop can advance.
      await jest.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(2_000);
      await Promise.resolve();

      await expect(promise).resolves.toThrow(BadGatewayException);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not retry a 429 — quota retries only make the situation worse', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 } as unknown as Response);

      const provider = new GeminiProvider(makeConfig());

      const error = await call(provider).catch((err: HttpException) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 500 — only 503 is retryable', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      } as unknown as Response);

      const provider = new GeminiProvider(makeConfig());

      await expect(call(provider)).rejects.toThrow(BadGatewayException);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
