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
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  CORS_ORIGINS: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  MAIL_SMOKE_TO: string;
  CONTACT_TO: string;
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

  const config: EnvConfig = {
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
    // Empty means "chat not configured": boot succeeds, chat routes 503. The
    // seed, tests, and every non-chat flow must not require a Google account.
    GEMINI_API_KEY: optional(raw, 'GEMINI_API_KEY', ''),
    GEMINI_MODEL: optional(raw, 'GEMINI_MODEL', 'gemini-3.5-flash'),
    // Comma-separated origin allowlist for the web/ site. Empty means no
    // CORS headers at all, which is what every deployment had before it
    // existed — opening a browser to this API is opt-in.
    CORS_ORIGINS: optional(raw, 'CORS_ORIGINS', ''),
    // Email remains optional at boot so local content development works, but
    // `/health` is degraded and auth responses expose queue failure until set.
    RESEND_API_KEY: optional(raw, 'RESEND_API_KEY', ''),
    MAIL_FROM: optional(raw, 'MAIL_FROM', 'GENKŌ <noreply@genko.app>'),
    // Dev-only fallback transport. Resend wins when both are configured;
    // Gmail SMTP is useful when no sender domain is available.
    SMTP_HOST: optional(raw, 'SMTP_HOST', 'smtp.gmail.com'),
    SMTP_PORT: positiveInt(raw, 'SMTP_PORT', 587),
    SMTP_USER: optional(raw, 'SMTP_USER', ''),
    SMTP_PASS: optional(raw, 'SMTP_PASS', ''),
    // Admin-only smoke endpoint destination. Empty disables the endpoint.
    MAIL_SMOKE_TO: optional(raw, 'MAIL_SMOKE_TO', ''),
    // Public contact requests are queued to this inbox. Empty deliberately
    // makes POST /contact return 503 rather than claiming to deliver nowhere.
    CONTACT_TO: optional(raw, 'CONTACT_TO', ''),
  };

  // A public production process must not boot into a state where registration
  // succeeds but verification cannot arrive, support forms discard messages,
  // the advertised AI tutor always returns 503, or browser requests are denied.
  // Local development keeps all four optional.
  if (config.NODE_ENV === 'production') {
    const hasMail = config.RESEND_API_KEY !== ''
      || (config.SMTP_USER !== '' && config.SMTP_PASS !== '');
    if (!hasMail) {
      throw new Error('Production requires RESEND_API_KEY or both SMTP_USER and SMTP_PASS');
    }
    for (const key of ['MAIL_SMOKE_TO', 'CONTACT_TO', 'GEMINI_API_KEY', 'CORS_ORIGINS'] as const) {
      if (config[key] === '') throw new Error(`Production requires ${key}`);
    }
  }

  return config;
}
