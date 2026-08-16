import { validateEnv } from './env.validation';

const base = {
  MONGO_URI: 'mongodb://localhost/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'access-secret-that-is-long-enough-0001',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-long-enough-0002',
};

const production = {
  ...base,
  NODE_ENV: 'production',
  RESEND_API_KEY: 're_test',
  MAIL_SMOKE_TO: 'ops@example.com',
  CONTACT_TO: 'support@example.com',
  GEMINI_API_KEY: 'gemini-test',
  CORS_ORIGINS: 'https://learn.example.com',
};

describe('validateEnv production readiness', () => {
  it('keeps external services optional for local development', () => {
    expect(validateEnv(base).NODE_ENV).toBe('development');
  });

  it('accepts a fully configured public production process', () => {
    expect(validateEnv(production).CONTACT_TO).toBe('support@example.com');
  });

  it.each(['MAIL_SMOKE_TO', 'CONTACT_TO', 'GEMINI_API_KEY', 'CORS_ORIGINS'] as const)(
    'refuses production without %s',
    (key) => {
      expect(() => validateEnv({ ...production, [key]: '' })).toThrow(`Production requires ${key}`);
    },
  );

  it('refuses production without a mail transport', () => {
    expect(() => validateEnv({ ...production, RESEND_API_KEY: '' })).toThrow(
      'Production requires RESEND_API_KEY or both SMTP_USER and SMTP_PASS',
    );
  });

  it('accepts complete SMTP credentials instead of Resend', () => {
    expect(validateEnv({
      ...production,
      RESEND_API_KEY: '',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASS: 'app-password',
    }).SMTP_USER).toBe('mailer@example.com');
  });
});
