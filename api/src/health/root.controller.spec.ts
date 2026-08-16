import { HealthReport, HealthService } from './health.service';
import { RootController } from './root.controller';

function controller(report: Partial<HealthReport> = {}): RootController {
  const full: HealthReport = {
    status: 'ok',
    uptimeSeconds: 42,
    checks: {
      mongo: { status: 'up', latencyMs: 1 },
      redis: { status: 'up', latencyMs: 1 },
      mail: {
        status: 'up',
        configured: true,
        queue: {
          status: 'up',
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 10,
        },
      },
    },
    ...report,
  };

  return new RootController({ check: () => Promise.resolve(full) } as unknown as HealthService);
}

describe('RootController', () => {
  it('renders a page rather than 404ing at /', async () => {
    const html = await controller().index();

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('GENKŌ');
    expect(html).toContain('running');
  });

  it('still renders when a dependency is down', async () => {
    // Deliberately unlike GET /health, which throws 503 so a load balancer sees
    // a non-2xx. A status page that goes blank exactly when something breaks is
    // useless — degraded is the state you most want to be able to look at.
    const html = await controller({
      status: 'degraded',
      checks: {
        mongo: { status: 'down', latencyMs: 30, error: 'connection refused' },
        redis: { status: 'up', latencyMs: 1 },
        mail: {
          status: 'up',
          configured: true,
          queue: {
            status: 'up',
            waiting: 0,
            active: 0,
            delayed: 0,
            failed: 0,
            completed: 10,
          },
        },
      },
    }).index();

    expect(html).toContain('degraded');
    expect(html).toContain('mongo down');
  });

  it('shows mail queue retries and terminal failure counts', async () => {
    const html = await controller({
      status: 'degraded',
      checks: {
        mongo: { status: 'up', latencyMs: 1 },
        redis: { status: 'up', latencyMs: 1 },
        mail: {
          status: 'down',
          configured: true,
          queue: {
            status: 'down',
            waiting: 1,
            active: 1,
            delayed: 2,
            failed: 3,
            completed: 4,
            error: 'queue unavailable',
          },
          error: 'queue unavailable',
        },
      },
    }).index();

    expect(html).toContain('mail down');
    expect(html).toContain('2 retrying');
    expect(html).toContain('3 failed');
  });

  it('lists the endpoints as text, not links', async () => {
    const html = await controller().index();

    expect(html).toContain('/me/progress');
    // Behind a Funnel path mount the prefix is stripped, so the app can't know
    // its public base path — any href it emitted would point somewhere wrong.
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
  });

  it('formats uptime in the largest sensible unit', async () => {
    expect(await controller({ uptimeSeconds: 45 }).index()).toContain('up 45s');
    expect(await controller({ uptimeSeconds: 3600 }).index()).toContain('up 1h');
    expect(await controller({ uptimeSeconds: 172_800 }).index()).toContain('up 2d');
  });
});
