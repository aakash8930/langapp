import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';
import { MailService, type MailHealth } from '../mail/mail.service';

function makeService(opts: {
  mongoPing: () => Promise<unknown>;
  redisPing: () => Promise<string>;
  mailHealth?: () => Promise<MailHealth>;
}): HealthService {
  const connection = {
    db: { admin: () => ({ ping: opts.mongoPing }) },
  } as unknown as Connection;

  const redis = { client: { ping: opts.redisPing } } as unknown as RedisService;
  const mail = {
    health:
      opts.mailHealth ??
      (() =>
        Promise.resolve({
          status: 'up' as const,
          configured: true,
          queue: {
            status: 'up' as const,
            waiting: 0,
            active: 0,
            delayed: 0,
            failed: 0,
            completed: 2,
          },
        })),
  } as unknown as MailService;

  return new HealthService(connection, redis, mail);
}

describe('HealthService', () => {
  it('reports ok when both dependencies answer', async () => {
    const service = makeService({
      mongoPing: () => Promise.resolve({ ok: 1 }),
      redisPing: () => Promise.resolve('PONG'),
    });

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.checks.mongo.status).toBe('up');
    expect(report.checks.redis.status).toBe('up');
  });

  it('reports degraded and keeps the error when Redis is down', async () => {
    const service = makeService({
      mongoPing: () => Promise.resolve({ ok: 1 }),
      redisPing: () => Promise.reject(new Error('connection refused')),
    });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.mongo.status).toBe('up');
    expect(report.checks.redis).toMatchObject({ status: 'down', error: 'connection refused' });
  });

  it('reports degraded when mail transport is unconfigured and exposes queue counts', async () => {
    const service = makeService({
      mongoPing: () => Promise.resolve({ ok: 1 }),
      redisPing: () => Promise.resolve('PONG'),
      mailHealth: () =>
        Promise.resolve({
          status: 'down',
          configured: false,
          queue: {
            status: 'up',
            waiting: 1,
            active: 0,
            delayed: 2,
            failed: 3,
            completed: 4,
          },
          error: 'RESEND_API_KEY is not configured',
        }),
    });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.mail).toMatchObject({
      status: 'down',
      configured: false,
      queue: { status: 'up', delayed: 2, failed: 3 },
    });
  });

  it('reports degraded when Mongo has no live connection', async () => {
    const service = makeService({
      mongoPing: () => Promise.reject(new Error('server selection timed out')),
      redisPing: () => Promise.resolve('PONG'),
    });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.mongo.status).toBe('down');
  });
});
