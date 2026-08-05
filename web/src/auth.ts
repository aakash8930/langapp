/**
 * Session and token storage for the browser.
 *
 * ## Where the tokens live, and what that costs
 *
 * `localStorage`. The Expo app uses expo-secure-store — Keychain on iOS,
 * Keystore on Android — and there is no browser equivalent: every web storage
 * API is readable by any script running on the page.
 *
 * The alternative worth taking seriously is httpOnly cookies, which script
 * cannot read at all. It was not taken because it is an API change with a tail:
 * the server would have to issue and clear cookies, CORS would need
 * `credentials: true` (and therefore a strict origin, not a list), and CSRF
 * protection becomes mandatory the moment the browser attaches credentials on
 * its own. That is a security *redesign*, not a storage swap.
 *
 * So the trade, stated plainly: **an XSS on this site can steal a session.**
 * What makes that tolerable for now is that the site renders no user-generated
 * content, loads no third-party script (Google Fonts is a stylesheet), and
 * React escapes by default. What would change the answer is a comment box, an
 * analytics snippet, or an embed — any of which should come with the cookie
 * rework. Logged in OPEN-ITEMS.
 */

const ACCESS_KEY = 'langapp.accessToken';
const REFRESH_KEY = 'langapp.refreshToken';

export type Tokens = { accessToken: string; refreshToken: string };

export type User = {
  id: string;
  email: string;
  isAdmin?: boolean;
  profile: { displayName: string; nativeLanguage: string; activeTrack: string };
  gamification: { xp: number; streakDays: number; lastStudyDate: string | null; dailyGoalXp: number };
  /**
   * `leaderboardOptIn` was missing from this type until the Settings screen
   * needed it — the server has always sent it (see `UserResponse`), so the
   * field was arriving and being dropped on the floor. That is the quiet
   * failure mode of a hand-written client type: an *absent* field is not a type
   * error anywhere, it just means nothing can render it.
   *
   * `theme` stays a plain `string` rather than the `Theme` union, because this
   * is what came off the wire and the wire is not type-checked. The Settings
   * form narrows it at the point of use.
   */
  settings: { audioSpeed: number; theme: string; tz: string; leaderboardOptIn: boolean };
  learningState: { knownKana: string[] };
};

/** Storage can throw — Safari private mode, or a user who blocked it entirely. */
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A session that cannot be persisted still works for this tab; it just
    // does not survive a reload. Better than refusing to sign in.
  }
}

export function getTokens(): Tokens | null {
  const accessToken = safeRead(ACCESS_KEY);
  const refreshToken = safeRead(REFRESH_KEY);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function setTokens(tokens: Tokens): void {
  safeWrite(ACCESS_KEY, tokens.accessToken);
  safeWrite(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  safeWrite(ACCESS_KEY, null);
  safeWrite(REFRESH_KEY, null);
}

/** Fires when a refresh fails for good, so the UI can drop to signed-out. */
const expiryListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export function emitSessionExpired(): void {
  clearTokens();
  for (const listener of expiryListeners) listener();
}
