import { Controller, Get, INestApplication, Module, VERSION_NEUTRAL } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { enableApiVersioning } from './versioning';

/**
 * Pins the routing contract from ADR-007 against a real HTTP server, because
 * that is the only place it is observable — the config is a bag of options until
 * a request either resolves or 404s.
 *
 * Dummy controllers rather than `AppModule`: the real app needs Mongo and Redis
 * and CI has neither, and what is under test is the versioning scheme, not the
 * routes. Every controller shape that matters is represented.
 */

/** A normal route: inherits the default versions. */
@Controller('thing')
class ThingController {
  @Get()
  get(): { served: string } {
    return { served: 'default' };
  }
}

/**
 * An operational route, deliberately outside the versioned surface.
 *
 * Note the shape: **controller-level versioning goes in the `@Controller`
 * options**, because `@Version()` writes its metadata to `descriptor.value` and
 * so only works on a method. Used as a class decorator it throws
 * `Cannot read properties of undefined (reading 'value')` at import time.
 */
@Controller({ path: 'ops', version: VERSION_NEUTRAL })
class OpsController {
  @Get()
  get(): { served: string } {
    return { served: 'ops' };
  }
}

/**
 * What a future breaking change must look like: a *new* controller that opts
 * into v2, leaving the old one answering the bare and `/v1` paths untouched.
 */
@Controller({ path: 'thing', version: '2' })
class ThingV2Controller {
  @Get()
  get(): { served: string } {
    return { served: 'v2' };
  }
}

@Module({ controllers: [ThingController, OpsController, ThingV2Controller] })
class VersioningTestModule {}

describe('enableApiVersioning (ADR-007)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(VersioningTestModule, { logger: false });
    enableApiVersioning(app);
    // Port 0 so parallel jest workers cannot collide; loopback only.
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function get(path: string): Promise<{ status: number; body: string }> {
    const response = await fetch(`${base}${path}`);
    return { status: response.status, body: await response.text() };
  }

  /**
   * The one that protects installed builds: an APK that predates versioning
   * knows only the bare path, and it has to keep working after a v2 exists.
   */
  it('serves an unversioned route at its bare path', async () => {
    const { status, body } = await get('/thing');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ served: 'default' });
  });

  it('serves the same route under /v1, from the same handler', async () => {
    const { status, body } = await get('/v1/thing');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ served: 'default' });
  });

  /**
   * The bare path is pinned to v1, not aliased to "latest". A v2 controller
   * exists in this module, and the bare path must still answer v1 — otherwise
   * adding a v2 would silently re-point every old client at it.
   */
  it('keeps the bare path on v1 semantics even though a v2 route exists', async () => {
    expect(JSON.parse((await get('/thing')).body)).toEqual({ served: 'default' });
    expect(JSON.parse((await get('/v1/thing')).body)).toEqual({ served: 'default' });
    expect(JSON.parse((await get('/v2/thing')).body)).toEqual({ served: 'v2' });
  });

  it('404s a version nothing has opted into', async () => {
    expect((await get('/v3/thing')).status).toBe(404);
  });

  it('serves a VERSION_NEUTRAL route bare and nowhere else', async () => {
    expect((await get('/ops')).status).toBe(200);
    expect((await get('/v1/ops')).status).toBe(404);
    expect((await get('/v2/ops')).status).toBe(404);
  });

  /**
   * `v` is part of the public contract now — a client builds `${base}/v1/…` — so
   * a change of prefix would break every caller and should fail here first.
   */
  it('uses `v` as the version prefix', async () => {
    expect((await get('/1/thing')).status).toBe(404);
    expect((await get('/version1/thing')).status).toBe(404);
  });
});
