/**
 * Plain, boring env validation. Runs once at boot via ConfigModule's `validate`.
 * Anything missing or malformed fails the process immediately rather than
 * surfacing as a confusing runtime error later.
 */
export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  AUTH_THROTTLE_LIMIT: number;
  AUTH_THROTTLE_TTL_SECONDS: number;
  CHAT_THROTTLE_LIMIT: number;
  CHAT_THROTTLE_TTL_SECONDS: number;
  STORAGE_DIR: string;
  XP_PER_LESSON_PRACTICE: number;
  HEARTS_REGEN_MINUTES: number;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  CORS_ORIGINS: string;
}

function required(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required env var: ${key} (see .env.example)`);
  }
  return value.trim();
}

function optional(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function positiveInt(raw: Record<string, unknown>, key: string, fallback: number): number {
  const value = Number(raw[key] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid env var: ${key} must be a positive integer, got "${String(raw[key])}"`);
  }
  return value;
}

/**
 * §10: secrets come from env, never the repo. A short secret is worse than no
 * auth at all, so the length floor is enforced at boot rather than trusted.
 */
function secret(raw: Record<string, unknown>, key: string): string {
  const value = required(raw, key);
  if (value.length < 32) {
    throw new Error(`Weak env var: ${key} must be at least 32 characters`);
  }
  return value;
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const accessSecret = secret(raw, 'JWT_ACCESS_SECRET');
  const refreshSecret = secret(raw, 'JWT_REFRESH_SECRET');

  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  return {
    NODE_ENV: optional(raw, 'NODE_ENV', 'development'),
    PORT: positiveInt(raw, 'PORT', 3000),
    MONGO_URI: required(raw, 'MONGO_URI'),
    REDIS_URL: required(raw, 'REDIS_URL'),
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL: optional(raw, 'JWT_ACCESS_TTL', '15m'),
    JWT_REFRESH_TTL: optional(raw, 'JWT_REFRESH_TTL', '7d'),
    AUTH_THROTTLE_LIMIT: positiveInt(raw, 'AUTH_THROTTLE_LIMIT', 10),
    AUTH_THROTTLE_TTL_SECONDS: positiveInt(raw, 'AUTH_THROTTLE_TTL_SECONDS', 60),
    CHAT_THROTTLE_LIMIT: positiveInt(raw, 'CHAT_THROTTLE_LIMIT', 10),
    CHAT_THROTTLE_TTL_SECONDS: positiveInt(raw, 'CHAT_THROTTLE_TTL_SECONDS', 60),
    STORAGE_DIR: optional(raw, 'STORAGE_DIR', './storage'),
    XP_PER_LESSON_PRACTICE: positiveInt(raw, 'XP_PER_LESSON_PRACTICE', 2),
    // Minutes per regenerated heart. Tunable because Duolingo's value exists to
    // sell refills and this app has nothing to sell — the right number for a solo
    // learner who wants to grind is much lower. `positiveInt` also stops a zero
    // from reaching the divide in `heartsNow`.
    HEARTS_REGEN_MINUTES: positiveInt(raw, 'HEARTS_REGEN_MINUTES', 30),
    // Empty means "chat not configured": boot succeeds, chat routes 503. The
    // seed, tests, and every non-chat flow must not require a Google account.
    GEMINI_API_KEY: optional(raw, 'GEMINI_API_KEY', ''),
    GEMINI_MODEL: optional(raw, 'GEMINI_MODEL', 'gemini-3.5-flash'),
    // Comma-separated origin allowlist for the web/ site. Empty means no
    // CORS headers at all, which is what every deployment had before it
    // existed — opening a browser to this API is opt-in.
    CORS_ORIGINS: optional(raw, 'CORS_ORIGINS', ''),
  };
}
