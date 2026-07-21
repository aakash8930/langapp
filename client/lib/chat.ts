import { ApiError } from '@/api/client';
import { errorText, isOffline } from '@/lib/errors';

/** The server's cap on one message. Enforced here so the composer can say so. */
export const MESSAGE_MAX_LENGTH = 500;
/** Show the counter only when it starts to matter. */
export const COUNTER_VISIBLE_FROM = 400;

export type ChatErrorCopy = {
  /** One line, under the composer. */
  message: string;
  /** Whether re-sending the same text could plausibly work. */
  canRetry: boolean;
  /** The session is spent; the only way forward is a new one. */
  needsNewSession: boolean;
};

/**
 * Chat fails in ways the generic copy gets wrong.
 *
 * `describeError` maps every 5xx to "the server errored, trying again often
 * works". For a 503 here that is actively misleading: it means the API has no
 * `GEMINI_API_KEY`, so no amount of trying will help and the fix is on the
 * laptop, not the phone. 429 is likewise ambiguous — it could be this app's
 * throttle or the provider's quota, and the learner cannot tell the difference,
 * so the copy doesn't pretend to.
 */
export function chatErrorCopy(error: unknown): ChatErrorCopy {
  if (isOffline(error)) {
    return { message: errorText(error), canRetry: true, needsNewSession: false };
  }

  if (error instanceof ApiError) {
    if (error.status === 503) {
      return {
        message:
          'AI chat isn’t set up on the server yet. Add GEMINI_API_KEY to the API’s .env and restart it.',
        canRetry: false,
        needsNewSession: false,
      };
    }

    if (error.status === 429) {
      return {
        message: 'Too many messages just now. Wait about a minute, then send it again.',
        canRetry: true,
        needsNewSession: false,
      };
    }

    if (error.status === 502) {
      return {
        message: 'The tutor couldn’t answer that one. Send it again, or reword it.',
        canRetry: true,
        needsNewSession: false,
      };
    }

    // The 50-message cap. The server says so in plain words; the flag is what
    // turns the retry button into a start-over button.
    if (error.status === 400 && /full/i.test(error.message)) {
      return { message: error.message, canRetry: false, needsNewSession: true };
    }

    if (error.status === 404) {
      return {
        message: 'This chat has expired. Start a new one to keep practising.',
        canRetry: false,
        needsNewSession: true,
      };
    }

    return { message: error.message, canRetry: error.status >= 500, needsNewSession: false };
  }

  return { message: errorText(error), canRetry: true, needsNewSession: false };
}

/**
 * Local ids for messages the server has not acknowledged yet.
 *
 * Prefixed so nothing mistakes one for a real `_id`, and only ever used as a
 * React key — a pending message is replaced by the server's copy the moment
 * the turn lands.
 */
export function localMessageId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
