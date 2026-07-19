import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';

function makeService(opts: {
  mongoPing: () => Promise<unknown>;
  redisPing: () => Promise<string>;
}): HealthService {
  const connection = {
    db: { admin: () => ({ ping: opts.mongoPing }) },
  } as unknown as Connection;

  const redis = { client: { ping: opts.redisPing } } as unknown as RedisService;

  return new HealthService(connection, redis);
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
