import { INestApplication, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';

/**
 * The version every route in this build answers to. Bump nothing here to add a
 * v2 — see the rule below.
 */
export const API_VERSION = '1';

/**
 * URI versioning (ADR-007), with every route served **twice**: at its bare path
 * and under `/v1`.
 *
 * ## Why versioning at all
 *
 * The contract has already had one breaking change with no version to absorb it:
 * `dateOfBirth` became required at registration on 2026-07-26, and every build
 * older than that gets a 400 on signup. There are three client shapes — the Expo
 * app, `web/`, and any sideloaded APK a tester never updates — and an installed
 * APK cannot be recalled. Phase 2 changes response shapes repeatedly.
 *
 * ## Why URI and not a header
 *
 * `Accept-Version` is tidier in theory and worse here. The funnel mounts this
 * app at `/langapp` and **strips the prefix before proxying**, so the app cannot
 * know its own public base path; a path segment the client appends after the
 * base works regardless of what the funnel mounts, and it is visible in a log, a
 * `curl`, and a browser address bar. A header is invisible in exactly the places
 * a solo maintainer debugs from.
 *
 * ## Why both paths, and what the bare path means
 *
 * `defaultVersion: [VERSION_NEUTRAL, '1']` registers each route at `/lessons`
 * *and* `/v1/lessons`. The bare path is not "latest" — it is **permanently
 * pinned to v1 semantics**, which is the whole protection: an old build that
 * knows nothing about versions keeps working forever, and it keeps working even
 * after a v2 exists.
 *
 * That gives one rule, and breaking it is the way this design fails:
 *
 * > **A v2 is a new route or controller carrying `@Version('2')`. Never add
 * > `@Version('2')` to an existing route.** Doing so replaces its version list,
 * > the bare and `/v1` paths stop resolving, and every installed client 404s —
 * > the exact outage this ADR exists to prevent, delivered by the mechanism
 * > meant to prevent it.
 *
 * `versioning.spec.ts` pins all of it, including that `/v2` is absent until
 * something opts in.
 *
 * Operational routes (`/`, `/health`) are `@Version(VERSION_NEUTRAL)` instead:
 * they are not part of the contract clients program against, a monitor pointed
 * at `/health` should not care what version the API is on, and `/v1` returning
 * an HTML status page would be nonsense.
 */
export function enableApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    // `v` is Nest's default; stated because the whole point is that this segment
    // is a stable part of the public contract.
    prefix: 'v',
    defaultVersion: [VERSION_NEUTRAL, API_VERSION],
  });
}
