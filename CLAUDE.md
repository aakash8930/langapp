# langapp — project root

AI-native language learning platform. Phase 0 = Japanese only, single-learner flow.
Full spec: `PHASE-0-BLUEPRINT.md`. Read it before any architectural decision.

This is a monorepo with two independent projects. They are **not** npm workspaces —
each has its own `package.json` and `node_modules` on purpose, because Expo's Metro
bundler resolves badly under hoisting.

```
api/     NestJS + MongoDB + Redis   (deployed via Tailscale Funnel)
client/  React Native + Expo
```

Each has its own `CLAUDE.md` with rules specific to it. Claude Code reads this file
plus the one in your working directory.

## The API contract (single source of truth)

Both sides depend on this. **If you change a response shape in `api/`, update this
section in the same commit**, then update `client/` to match. Drift here is the most
likely bug in the project.

```
POST /auth/register    { email, password }        -> { accessToken, refreshToken }
POST /auth/login       { email, password }        -> { accessToken, refreshToken }
POST /auth/refresh     { refreshToken }           -> { accessToken, refreshToken }

GET  /me               bearer -> { id, email, profile, gamification, settings }
PATCH /me/settings     bearer -> updated settings
GET  /me/progress      bearer -> { xp, level, streakDays, todayXp, dailyGoalXp,
                                   cardsDue, lessonsCompleted }

GET  /lessons?unit=            -> [ { id, title, order, locked, prerequisiteLessonIds } ]
GET  /lessons/:id              -> lesson with resolved items
GET  /lessons/:id/exercises              bearer -> [ { exerciseId, prompt, options } ]
POST /lessons/:id/exercises/:eid/answer  bearer -> { correct, correctAnswer }
POST /lessons/:id/complete               bearer -> { xpAwarded, cardsAdded }

GET  /reviews/due              bearer -> [ { cardId, item, state } ]  (max 20)
POST /reviews/:cardId/grade    bearer -> { nextDue, xpAwarded }
```

Auth: bearer token on everything except register/login/refresh. A 401 means the client
should attempt one refresh-and-retry, then clear the session.

**Never leak `passwordHash` or FSRS internals (`stability`, `difficulty`) to the client.**
The client shows `nextDue`, not the scheduling math.

## Ground rules across both projects

- TypeScript strict mode everywhere.
- Don't add dependencies without asking.
- One milestone at a time; stop and report before chaining ahead.
- Boring, obvious code — this is solo-maintained.
- When `PHASE-0-BLUEPRINT.md` is ambiguous, ask rather than assume.

## Phase 0 scope boundary

Not building yet: voice/STT/TTS, AR, a second language, teacher portal, marketplace,
social features, offline lesson caching, in-app purchases.

If a task appears to require one of these, stop and ask.

## Environment

```bash
# api/
docker compose up -d          # mongo + redis
npm run start:dev             # :3000
npm run seed                  # Japanese content pack

# client/
npx expo start                # scan QR with Expo Go
```

The API is served publicly over Tailscale Funnel — valid TLS, so the phone talks to it
with no cleartext or certificate workarounds. The client reads `EXPO_PUBLIC_API_URL`.

**Backups are manual.** The laptop holds the only copy of the database. A nightly
`mongodump` to a cloud-synced folder is required, not optional (§11).
