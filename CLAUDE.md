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

Modules: `auth`, `user`, `content`, `learning`, `knowledge-graph`, `analytics`
(later: `ai-orchestrator`, `chat`)

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
