# Backend rules (`api/`)

These rules govern the NestJS backend only. Workspace-wide rules live in
`../CLAUDE.md`.

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.
Full spec lives in `../PHASE-0-BLUEPRINT.md`. Read it before making architectural
decisions.

## Stack (do not substitute without asking)

- **NestJS + TypeScript** (strict mode on)
- **MongoDB** via `@nestjs/mongoose` — local Docker in dev
- **Redis** via `ioredis` — local Docker in dev
- **ts-fsrs** for spaced repetition scheduling
- **argon2** for password hashing (not bcrypt)
- **@nestjs/jwt** for access/refresh tokens
- **class-validator + class-transformer** for DTO validation

## Architecture: modular monolith

One NestJS app. Modules map to future services but deploy as one unit.
**Do not** create microservices, message brokers, or separate deployables.

Modules: `auth`, `user`, `content`, `learning`, `knowledge-graph`, `analytics`,
`ai-orchestrator` and `chat` (2026-07-21 — Gemini behind `AiOrchestratorService`),
`social` (2026-07-26 — friends, DMs, leagues) and `jobs` (2026-07-28 — BullMQ,
ADR-006).

### The one rule that matters

**A module never touches another module's collections.** Cross-module access goes
through the owning module's exported service class only.

```ts
// WRONG — learning module reaching into user's collection
constructor(@InjectModel('User') private userModel: Model<User>) {}

// RIGHT — go through the owning service
constructor(private readonly userService: UserService) {}
```

This is what makes future extraction cheap. Enforce it in every review.

## Conventions

- Every endpoint has a DTO with `class-validator` decorators. No untyped `body: any`.
- Every Mongoose schema gets explicit indexes. `SrsCard` **must** have `{ userId: 1, due: 1 }`.
- Object/file storage goes behind the `StorageService` abstract class
  (`put/get/delete`) in `src/common/storage/`. `LocalStorageService` is the Stage A
  binding and writes under `STORAGE_DIR` (default `./storage/`). Inject
  `StorageService`, never the implementation, and never call `fs` directly from a
  feature module. Keys are untrusted — `resolveKey` is the containment boundary.
- Secrets come from env via `@nestjs/config`. Never commit `.env`.
- Errors: throw Nest's built-in HTTP exceptions. No custom error framework.
- Keep responses lean — don't return `passwordHash` ever. Use a serializer/DTO.

## What NOT to build in Phase 0

No microservices, no Kubernetes, no GraphQL, no event bus, no marketplace, no teacher
portal, no i18n framework, no admin panel, no voice/STT/TTS, no AR, no second language.
If a task seems to need one of these, stop and ask.

## Phase 2

`PHASE-2-BLUEPRINT.md` landed 2026-07-27. Two items on the Phase 0 list above
have been reclassified and the rest stand:

- **No voice/STT/TTS** — Phase 2 keeps this restriction with a §3.3 carve-out:
  voice conversation is *premium-metered*, not forbidden. Building it needs the
  §6.8 design and the root CLAUDE.md §3.3 reconciliation read together; do not
  start without both.
- **No event bus** — superseded by ADR-006 (background jobs), which **landed
  2026-07-28**: BullMQ over the existing Redis, in `src/jobs/`. It is a
  Redis-backed job runner, not a general event bus — the original prohibition was
  about message brokers and pub/sub, which are still out.

  Three rules hold it together, and the first two are not style preferences:

  1. **One queue per concern.** A BullMQ worker consumes *every* job on its
     queue, whatever the job is named — names do not route. Two `@Processor`
     classes on one queue means two workers each pulling the other's jobs, on a
     race. `jobs/queues.ts` is the registry and `jobs/queue-topology.spec.ts`
     fails if two ever share a queue.
  2. **The processor lives in the module that owns the data it writes** —
     `AnalyticsProcessor` in `analytics/`, `LeagueSettleProcessor` in `social/`.
     `jobs/` holds the connection, the registrations and the producer, and
     touches nobody's collections. This is the one rule that matters, applied to
     workers.
  3. **`JobsService.enqueue` never throws.** A queue failure must not fail the
     user's action. The cost is that an enqueue bug is *silent* — an invalid
     `jobId` looked exactly like a working system until it was checked live — so
     anything computed into a job's options wants a unit test (see
     `settleJobId`).

  Workers run in-process; there is no separate worker deployable, and adding one
  is a §11 decision, not a refactor.

The items not addressed above (microservices, Kubernetes, GraphQL, marketplace,
teacher portal, i18n framework, admin panel, AR, second language) remain
forbidden. None of them are in `PHASE-2-BLUEPRINT.md`.

Hearts and gems are gone (Phase 2 §3.1). Leagues are promotion-only and
opt-in (§3.2). Both are committed on `phase-2-foundations`; do not reintroduce
either.

## Commands

All run from `api/`:

```bash
docker compose up -d      # mongo + redis
npm run start:dev         # api on :3000
npm run test              # unit
npm run seed              # load Japanese content pack
```

`docker-compose.yml` pins `name: langapp` — see the note in `../CLAUDE.md`
before touching it.

## Working style

- Work one milestone at a time. Stop and report after each; don't chain ahead.
- Don't add npm dependencies without asking first.
- Prefer boring, obvious code over clever abstractions. This is a solo-maintained repo.
- When something in `../PHASE-0-BLUEPRINT.md` or `../PHASE-2-BLUEPRINT.md` is
  ambiguous, ask rather than assume.

# Project rules

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.
Full spec lives in `PHASE-0-BLUEPRINT.md`. Read it before making architectural decisions.

## Stack (do not substitute without asking)

- **NestJS + TypeScript** (strict mode on)
- **MongoDB** via `@nestjs/mongoose` — local Docker in dev
- **Redis** via `ioredis` — local Docker in dev
- **ts-fsrs** for spaced repetition scheduling
- **argon2** for password hashing (not bcrypt)
- **@nestjs/jwt** for access/refresh tokens
- **class-validator + class-transformer** for DTO validation

## Architecture: modular monolith

One NestJS app. Modules map to future services but deploy as one unit.
**Do not** create microservices, message brokers, or separate deployables.

Modules: `auth`, `user`, `content`, `learning`, `knowledge-graph`, `analytics`,
`ai-orchestrator` and `chat` (2026-07-21 — Gemini behind `AiOrchestratorService`),
`social` (2026-07-26 — friends, DMs, leagues) and `jobs` (2026-07-28 — BullMQ,
ADR-006).

### The one rule that matters

**A module never touches another module's collections.** Cross-module access goes
through the owning module's exported service class only.

```ts
// WRONG — learning module reaching into user's collection
constructor(@InjectModel('User') private userModel: Model<User>) {}

// RIGHT — go through the owning service
constructor(private readonly userService: UserService) {}
```

This is what makes future extraction cheap. Enforce it in every review.

## Conventions

- Every endpoint has a DTO with `class-validator` decorators. No untyped `body: any`.
- Every Mongoose schema gets explicit indexes. `SrsCard` **must** have `{ userId: 1, due: 1 }`.
- Object/file storage goes behind a `StorageService` interface (`put/get/delete`).
  Dev implementation writes to `./storage/`. Never call `fs` directly from a feature module.
- Secrets come from env via `@nestjs/config`. Never commit `.env`.
- Errors: throw Nest's built-in HTTP exceptions. No custom error framework.
- Keep responses lean — don't return `passwordHash` ever. Use a serializer/DTO.

## What NOT to build in Phase 0

No microservices, no Kubernetes, no GraphQL, no event bus, no marketplace, no teacher
portal, no i18n framework, no admin panel, no voice/STT/TTS, no AR, no second language.
If a task seems to need one of these, stop and ask.

## Phase 2

`PHASE-2-BLUEPRINT.md` landed 2026-07-27. Two items on the Phase 0 list above
have been reclassified and the rest stand:

- **No voice/STT/TTS** — Phase 2 keeps this restriction with a §3.3 carve-out:
  voice conversation is *premium-metered*, not forbidden. Building it needs the
  §6.8 design and the root CLAUDE.md §3.3 reconciliation read together; do not
  start without both.
- **No event bus** — superseded by ADR-006 (background jobs), which **landed
  2026-07-28**: BullMQ over the existing Redis, in `src/jobs/`. It is a
  Redis-backed job runner, not a general event bus — the original prohibition was
  about message brokers and pub/sub, which are still out.

  Three rules hold it together, and the first two are not style preferences:

  1. **One queue per concern.** A BullMQ worker consumes *every* job on its
     queue, whatever the job is named — names do not route. Two `@Processor`
     classes on one queue means two workers each pulling the other's jobs, on a
     race. `jobs/queues.ts` is the registry and `jobs/queue-topology.spec.ts`
     fails if two ever share a queue.
  2. **The processor lives in the module that owns the data it writes** —
     `AnalyticsProcessor` in `analytics/`, `LeagueSettleProcessor` in `social/`.
     `jobs/` holds the connection, the registrations and the producer, and
     touches nobody's collections. This is the one rule that matters, applied to
     workers.
  3. **`JobsService.enqueue` never throws.** A queue failure must not fail the
     user's action. The cost is that an enqueue bug is *silent* — an invalid
     `jobId` looked exactly like a working system until it was checked live — so
     anything computed into a job's options wants a unit test (see
     `settleJobId`).

  Workers run in-process; there is no separate worker deployable, and adding one
  is a §11 decision, not a refactor.

The items not addressed above (microservices, Kubernetes, GraphQL, marketplace,
teacher portal, i18n framework, admin panel, AR, second language) remain
forbidden. None of them are in `PHASE-2-BLUEPRINT.md`.

Hearts and gems are gone (Phase 2 §3.1). Leagues are promotion-only and
opt-in (§3.2). Both are committed on `phase-2-foundations`; do not reintroduce
either.

## Commands

```bash
docker compose up -d      # mongo + redis
npm run start:dev         # api on :3000
npm run test              # unit
npm run seed              # load Japanese content pack
```

## Working style

- Work one milestone at a time. Stop and report after each; don't chain ahead.
- Don't add npm dependencies without asking first.
- Prefer boring, obvious code over clever abstractions. This is a solo-maintained repo.
- When something in `PHASE-0-BLUEPRINT.md` is ambiguous, ask rather than assume.
