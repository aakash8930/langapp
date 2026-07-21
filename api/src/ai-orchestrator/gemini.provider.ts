import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GenerateJsonInput {
  system: string;
  turns: GeminiTurn[];
  /** Gemini's OpenAPI-style schema — uppercase type names ('OBJECT', 'STRING'). */
  responseSchema: Record<string, unknown>;
  maxOutputTokens?: number;
}

/** Shape of the slice of the generateContent response we actually read. */
interface GeminiResponseBody {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Hand-rolled call to Gemini's generateContent — one HTTPS POST, no SDK
 * dependency (same trade as the Redis ThrottlerStorage). Stage A runs on the
 * Gemini free tier (§8): swap this class behind AiOrchestratorService to move
 * providers.
 *
 * Never log message content — chat text is PII (§10 inventory).
 */
@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** Calls Gemini and returns the model's JSON output, parsed. */
  async generateJson(input: GenerateJsonInput): Promise<unknown> {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    if (apiKey === '') {
      throw new ServiceUnavailableException(
        'AI chat is not configured on this server (missing GEMINI_API_KEY)',
      );
    }

    const model = this.config.getOrThrow<string>('GEMINI_MODEL');
    const body = {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: input.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: input.responseSchema,
        maxOutputTokens: input.maxOutputTokens ?? 2048,
      },
    };

    const response = await this.post(model, apiKey, body);
    return this.extractJson(response);
  }

  private async post(model: string, apiKey: string, body: unknown): Promise<GeminiResponseBody> {
    let response: Response;
    try {
      response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Header, not ?key= query param — keys in URLs end up in logs.
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(
        `Gemini request failed before a response: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadGatewayException('The AI tutor is unreachable right now — try again shortly');
    }

    if (response.status === 429) {
      throw new HttpException(
        'The AI tutor is rate limited right now — wait a minute and try again',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!response.ok) {
      // Log status + provider error text (no user content lives in there).
      const detail = await response.text().catch(() => '');
      this.logger.warn(`Gemini returned ${response.status}: ${detail.slice(0, 500)}`);
      throw new BadGatewayException('The AI tutor hit an error — try again shortly');
    }

    return (await response.json()) as GeminiResponseBody;
  }

  private extractJson(data: GeminiResponseBody): unknown {
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.length) {
      this.logger.warn(
        `Gemini returned no candidate (blockReason=${data.promptFeedback?.blockReason ?? 'none'}, ` +
          `finishReason=${candidate?.finishReason ?? 'none'})`,
      );
      throw new BadGatewayException('The AI tutor could not answer that — try rephrasing');
    }

    if (candidate.finishReason === 'MAX_TOKENS') {
      this.logger.warn('Gemini response truncated at maxOutputTokens');
      throw new BadGatewayException('The AI tutor hit an error — try again shortly');
    }

    // Thinking-capable models can interleave thought parts; only concatenate
    // the answer parts.
    const text = candidate.content.parts
      .filter((part) => part.thought !== true)
      .map((part) => part.text ?? '')
      .join('');

    try {
      return JSON.parse(text);
    } catch {
      this.logger.warn('Gemini returned non-JSON output despite responseSchema');
      throw new BadGatewayException('The AI tutor hit an error — try again shortly');
    }
  }
}
