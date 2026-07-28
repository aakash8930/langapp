import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * A human-readable page at `/`, so opening the deployed URL in a browser shows
 * that the service is alive instead of NestJS's `Cannot GET /` 404.
 *
 * Lives in the health module because that's what it is — a status page — and it
 * reuses `HealthService` rather than re-pinging Mongo and Redis itself.
 *
 * Endpoints are listed as **plain text, not links**, and that's deliberate: in
 * the deployment this sits behind a Tailscale Funnel path mount (`/langapp`)
 * whose prefix is stripped before the request reaches us. The app therefore
 * cannot know its own public base path — an `href="/health"` would send the
 * browser to the funnel root (a different service entirely), and a relative
 * `href="health"` resolves differently depending on whether the visitor typed a
 * trailing slash. Text can't be wrong.
 *
 * `VERSION_NEUTRAL` (ADR-007): a status page is not part of the contract, and
 * `/v1` serving HTML would be nonsense. In the `@Controller` options because
 * `@Version()` only works on a method.
 */
@Controller({ version: VERSION_NEUTRAL })
export class RootController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  // Status is live, so never let a proxy or phone browser serve a stale copy.
  @Header('Cache-Control', 'no-store')
  async index(): Promise<string> {
    const report = await this.healthService.check();
    const ok = report.status === 'ok';

    // Everything interpolated below is either a fixed string or a number from
    // HealthService — no user input reaches this page, so there is nothing to
    // escape.
    return page(`
      <h1>langapp <span class="dim">· Phase 0</span></h1>
      <p class="status ${ok ? 'up' : 'down'}">
        <span class="dot"></span>${ok ? 'running' : 'degraded'}
        <span class="dim">
          · mongo ${report.checks.mongo.status} · redis ${report.checks.redis.status}
          · up ${formatUptime(report.uptimeSeconds)}
        </span>
      </p>

      <h2>Endpoints</h2>
      <ul class="routes">
        ${ROUTES.map(
          ([method, path, note]) => `
          <li>
            <span class="method ${method.toLowerCase()}">${method}</span>
            <code>${path}</code>
            ${note ? `<span class="dim">${note}</span>` : ''}
          </li>`,
        ).join('')}
      </ul>

      <p class="foot">
        Every path above is also served under <code>/v1</code> (ADR-007). The bare
        path is pinned to v1 rather than aliased to whatever is newest, so a build
        that predates versioning keeps working even after a <code>/v2</code>
        exists. <code>/health</code> and this page are unversioned.
      </p>

      <p class="foot">
        Japanese-only learning API. No web client yet — Phase 0 is the API alone,
        so every path above returns JSON.
      </p>
    `);
  }
}

/** `[method, path, note]`. Mirrors the table in README.md. */
const ROUTES: [string, string, string][] = [
  ['GET', '/health', 'dependency checks'],
  ['POST', '/auth/register', 'rate limited'],
  ['POST', '/auth/login', 'rate limited'],
  ['POST', '/auth/refresh', 'rotating token'],
  ['GET', '/me', 'bearer'],
  ['GET', '/me/progress', 'bearer · xp, streak, daily goal'],
  ['PATCH', '/me/settings', 'bearer'],
  ['GET', '/lessons?unit=', ''],
  ['GET', '/lessons/:id', ''],
  ['GET', '/lessons/:id/exercises', 'bearer'],
  ['POST', '/lessons/:id/complete', 'bearer · seeds cards, awards XP'],
  ['GET', '/reviews/due', 'bearer · capped at 20'],
  ['POST', '/reviews/:cardId/grade', 'bearer · FSRS'],
];

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/**
 * Inline styles only — a Funnel path mount means a stylesheet at an absolute
 * URL would resolve against the wrong base, and one small page doesn't justify
 * serving static assets. Sized for a phone first, since that's where the link
 * gets opened.
 */
function page(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>langapp · status</title>
<style>
  :root {
    --bg: #fbfbfa; --fg: #1a1a18; --dim: #6b6b66;
    --line: #e4e4e0; --up: #1a7f4b; --down: #b4342a; --code: #f2f2ef;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17171a; --fg: #e8e8e4; --dim: #94948d;
      --line: #2c2c30; --up: #4ac07d; --down: #e0685c; --code: #212125;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.35rem; margin: 0 0 .6rem; font-weight: 650; letter-spacing: -.01em; }
  h2 {
    font-size: .72rem; text-transform: uppercase; letter-spacing: .09em;
    color: var(--dim); margin: 2rem 0 .6rem; font-weight: 600;
  }
  .dim { color: var(--dim); font-weight: 400; }
  .status { margin: 0; font-weight: 550; }
  .status.up { color: var(--up); } .status.down { color: var(--down); }
  .dot {
    display: inline-block; width: .5rem; height: .5rem; border-radius: 50%;
    background: currentColor; margin-right: .45rem; vertical-align: baseline;
  }
  ul.routes { list-style: none; margin: 0; padding: 0; }
  ul.routes li {
    display: flex; flex-wrap: wrap; gap: .5rem; align-items: baseline;
    padding: .5rem 0; border-bottom: 1px solid var(--line);
  }
  .method {
    flex: none; min-width: 3.4rem; font-size: .68rem; font-weight: 700;
    letter-spacing: .05em; color: var(--dim);
  }
  .method.post { color: #2f6fb5; } .method.patch { color: #9a6b1f; }
  @media (prefers-color-scheme: dark) {
    .method.post { color: #6ea8e8; } .method.patch { color: #d3a95c; }
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem;
    background: var(--code); padding: .1rem .35rem; border-radius: 4px;
    word-break: break-all;
  }
  .foot { color: var(--dim); font-size: .85rem; margin-top: 1.75rem; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}
