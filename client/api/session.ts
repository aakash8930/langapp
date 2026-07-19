import * as SecureStore from 'expo-secure-store';

/**
 * Token storage.
 *
 * expo-secure-store only — Keychain on iOS, Keystore-backed on Android. Tokens
 * never touch AsyncStorage, which is world-readable on a rooted device.
 */

const ACCESS_TOKEN_KEY = 'langapp.accessToken';
const REFRESH_TOKEN_KEY = 'langapp.refreshToken';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Read-through cache. SecureStore hits the Keychain on every call, which is
 * slow enough to notice when every request needs the access token.
 */
let cached: Tokens | null = null;
let loaded = false;

export async function getTokens(): Promise<Tokens | null> {
  if (loaded) return cached;

  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  cached = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  loaded = true;
  return cached;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  cached = tokens;
  loaded = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  cached = null;
  loaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

/**
 * Fires when a refresh has failed and the session has been cleared. The root
 * layout subscribes and routes to login; `api/` stays free of navigation so it
 * can be used from anywhere without importing the router.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired(): void {
  for (const listener of listeners) listener();
}
