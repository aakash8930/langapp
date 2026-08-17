import { ApiError, OfflineError } from '@/api/client';

/**
 * How an error should read on screen.
 *
 * Two lines, always: what happened, and what to do about it. Never "Something
 * went wrong", and never an apology — neither tells anyone anything.
 */
export type ErrorCopy = {
  title: string;
  body: string;
  /** False for the handful of errors a retry button cannot fix. */
  retryable: boolean;
};

/**
 * The service being unreachable is a recoverable operating condition, not an
 * application crash. It gets its own copy so the learner knows to retry.
 */
export function isOffline(error: unknown): boolean {
  return error instanceof OfflineError || (error instanceof ApiError && error.status === 0);
}

export function describeError(error: unknown): ErrorCopy {
  if (isOffline(error)) {
    return {
      title: 'Can’t reach the server',
      body: 'Check your connection and try again. If this continues, the learning service may be unavailable.',
      retryable: true,
    };
  }

  if (error instanceof ApiError) {
    // 5xx and 429 are worth waiting out; a 4xx will answer the same way twice.
    if (error.status === 429) {
      return {
        title: 'Too many attempts',
        body: 'The server is rate limiting this. Wait about a minute, then try again.',
        retryable: true,
      };
    }

    if (error.status >= 500) {
      return {
        title: 'The server errored',
        body: `${sentence(error.message)} This is the API’s end, not yours — trying again often works.`,
        retryable: true,
      };
    }

    return { title: 'That didn’t work', body: error.message, retryable: error.status >= 500 };
  }

  return {
    title: 'That didn’t work',
    body:
      error instanceof Error && error.message
        ? error.message
        : 'An unexpected error stopped this from loading. Try again.',
    retryable: true,
  };
}

/**
 * Server messages arrive unpunctuated ("Internal server error"), and running
 * one straight into a sentence of ours reads as a single broken sentence.
 */
function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/** Single-line form, for inline slots too small for a title and a body. */
export function errorText(error: unknown): string {
  const { body } = describeError(error);
  return body;
}
