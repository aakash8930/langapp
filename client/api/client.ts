import {
  clearTokens,
  emitSessionExpired,
  getTokens,
  setTokens,
  type Tokens,
} from './session';

/**
 * The one place that talks to the API.
 *
 * Everything except register/login/refresh carries a bearer token. A 401 buys
 * exactly one refresh-and-retry; if the refresh fails the session is cleared
 * and `onSessionExpired` fires so the app can route to login.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

/** Endpoints that must not carry a bearer token or trigger a refresh. */
const PUBLIC_PATHS = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  // Both run before there is a session — a signed-out phone has no tokens to
  // attach, and without this list `apiFetch` would read that as an expired
  // session and reject before the request is even sent.
  '/auth/forgot-password',
  '/auth/reset-password',
  // Reachable from the register screen, before any account exists — same
  // reason as the two above. The server has no guard on either route either.
  '/legal/privacy',
  '/legal/terms',
];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * An unreachable learning service is a recoverable network condition, not an
 * application crash. Status 0 means the request never reached the server.
 */
export class OfflineError extends ApiError {
  constructor(
    message = 'Can’t reach the learning service. Check your connection, then try again.',
  ) {
    super(message, 0);
    this.name = 'OfflineError';
  }
}

/**
 * How long to wait before deciding the server is not going to answer.
 *
 * A refused connection rejects in milliseconds; the case that actually hangs
 * is a proxy still terminating TLS and accepting the connection while its API
 * upstream is unavailable. `fetch` has no default timeout, so without this the request waits
 * forever and the screen spins forever with it.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/** An abort raises DOMException on some runtimes and Error on others. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function requireBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env, fill in your API URL, and restart the dev server.',
    );
  }
  return BASE_URL.replace(/\/$/, '');
}

async function readError(response: Response): Promise<string> {
  // Nest's exception filter returns { message } or { message: string[] }.
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const { message } = body;
    if (Array.isArray(message)) return message.join('. ');
    if (message) return message;
  } catch {
    // Non-JSON body (a proxy error page, usually). Fall through.
  }
  return `The server returned ${response.status}. Try again.`;
}

async function send(path: string, init: RequestInit, accessToken?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${requireBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    // fetch only rejects on network failure; HTTP errors resolve normally.
    if (error instanceof TypeError) throw new OfflineError();
    if (isAbort(error)) {
      throw new OfflineError(
        'The learning service didn’t respond. Check your connection, then try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shared across concurrent 401s. Without this, five parallel queries failing at
 * once would fire five refreshes and four of them would race to lose — most
 * refresh implementations rotate the token, so the losers would be left holding
 * a token that is already dead.
 */
let refreshInFlight: Promise<Tokens> | null = null;

function refreshTokens(refreshToken: string): Promise<Tokens> {
  if (refreshInFlight) return refreshInFlight;

  const pending = (async () => {
    try {
      const response = await send('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) throw new ApiError(await readError(response), response.status);

      const tokens = (await response.json()) as Tokens;
      await setTokens(tokens);
      return tokens;
    } finally {
      refreshInFlight = null;
    }
  })();

  refreshInFlight = pending;
  return pending;
}

async function endSession(): Promise<never> {
  await clearTokens();
  emitSessionExpired();
  throw new ApiError('Your session expired. Sign in again.', 401);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isPublic = PUBLIC_PATHS.includes(path);
  const tokens = isPublic ? null : await getTokens();

  if (!isPublic && !tokens) await endSession();

  let response = await send(path, init, tokens?.accessToken);

  if (response.status === 401 && !isPublic && tokens) {
    const refreshed = await refreshTokens(tokens.refreshToken).catch((error: unknown) => {
      // A refresh that failed because the server is unreachable is not an
      // expired session — keep the tokens so the app recovers when it is back.
      if (error instanceof OfflineError) throw error;
      return endSession();
    });

    response = await send(path, init, refreshed.accessToken);

    // Still 401 after a good refresh: the token is genuinely rejected.
    if (response.status === 401) await endSession();
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);

  // 204 from endpoints with no body.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  // Added for the social routes — unfriending and unblocking are both DELETEs.
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
