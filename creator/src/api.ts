const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const BASE = `${API}/v1`;

export type AdminSession = { accessToken: string; refreshToken: string; user: { email: string; isAdmin: boolean; profile: { displayName: string } } };
export type ApiList<T> = { items: T[]; total: number; page?: number };

export async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(body?.message ?? `Request failed (${response.status})`); }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export async function login(email: string, password: string): Promise<AdminSession> {
  const result = await request<AdminSession>('/auth/login', undefined, { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!result.user.isAdmin) throw new Error('This account does not have administrator access.');
  return result;
}
