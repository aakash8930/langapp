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

> **Verified against the running API on 2026-07-19.** GET routes were probed live;
> POST shapes were read from the controllers and DTOs in `api/src`. The version
> before this date was written from the blueprint rather than the code and was
> wrong about nearly every response — if you find drift again, date it here.

Bearer token on everything marked `bearer`. A 401 means the client should attempt one
refresh-and-retry, then clear the session.

### Auth

```
POST /auth/register  { email, password, displayName, nativeLanguage?, tz? }  -> 201
POST /auth/login     { email, password }                                     -> 200
     both -> { user: <UserResponse>, tokens: { accessToken, refreshToken, expiresIn } }

POST /auth/refresh   { refreshToken }  -> 200
     -> { accessToken, refreshToken, expiresIn }        // flat, NOT nested under `tokens`
```

`displayName` is required, 1–60 chars. `password` is 8–128, `email` ≤254.

Refresh tokens **rotate**: the presented token is consumed, so replaying one fails at
the Redis check even though the signature still verifies. A client must therefore
serialise refreshes — concurrent 401s sharing one in-flight refresh, not one each.

`/auth/register` and `/auth/login` are rate limited (`AUTH_THROTTLE_*`, default 10 per
60s) and return **429** past the limit.

Login answers **401 `Invalid credentials` for both an unknown email and a wrong
password**, and burns a dummy argon2 verify when no user exists to keep timing flat.
That is deliberate anti-enumeration — do not "improve" the client copy by claiming
which field was wrong, because the API does not know and neither do you.

### Me

```
GET   /me            bearer -> <UserResponse>
PATCH /me/settings   bearer  { audioSpeed?, theme?, tz?, dailyGoalXp? }  -> <UserResponse>
GET   /me/progress   bearer -> { xp, level, xpIntoLevel, xpForNextLevel,
                                 streakDays, lastStudyDate,
                                 daily: { xpToday, goalXp, percentOfGoal, goalMet },
                                 cardsDueNow, lessonsCompleted, completedLessonIds }

UserResponse = { id, email, createdAt,
                 profile:      { displayName, nativeLanguage, activeTrack: 'ja' },
                 gamification: { xp, streakDays, lastStudyDate, dailyGoalXp },
                 settings:     { audioSpeed, theme, tz } }
```

`PATCH /me/settings` returns the **whole user**, not just the settings block.
`audioSpeed` is 0.5–2.0, `theme` is `light`/`dark`/`system`, `tz` an IANA zone name,
`dailyGoalXp` an integer 10–1000.

`dailyGoalXp` is patched through `/me/settings` but **stored on `gamification`, not
`settings`** — it is the target `/me/progress` measures the day against, so it lives
with the numbers it is compared to. It appears under `gamification` in `UserResponse`
for the same reason. Added 2026-07-19; before that it was fixed at 50 with no way to
change it.

`theme: 'system'` means follow the OS, which is what the client did unconditionally
before the setting existed. It was added to the enum on 2026-07-19 — existing rows hold
`light` or `dark` and stay valid, so no migration was needed. **The server does not
resolve `system`**; it stores the preference and the client picks the palette.

The default moved from `light` to `system` in the same change, so that honouring the
field is not a regression for anyone on a dark-mode phone. **Accounts created before
2026-07-19 have an explicit `light` stored** and will look light until changed once in
Settings — that is a stored value, not a bug.

Progress nests the daily numbers under `daily` — there is no top-level `todayXp` or
`dailyGoalXp`. `xpToday` is recomputed on read, because the stored counter still holds
yesterday's total until the next award rewrites it.

`completedLessonIds` exists so the client can compute lesson lock state; it was added
2026-07-19, since a bare `lessonsCompleted` count cannot answer which prerequisites are
satisfied. `lessonsCompleted` is now derived from its length, so the two cannot drift.

### Lessons — no bearer

```
GET /lessons?unit=  -> [ <LessonSummary> ]
GET /lessons/:id    -> <LessonSummary> & { items: [ <ResolvedItem> ] }

LessonSummary = { id, lang, unit, order, title,
                  exerciseTypes, itemCount, prerequisiteLessonIds }
ResolvedItem  = discriminated on `kind`:
  kana    { kind, id, kana, romaji, script, row, order }
  vocab   { kind, id, lemma, reading, gloss, pos, jlpt }
  grammar { kind, id, title, jlpt, explanation }
  kanji   { kind, id, char, on[], kun[], meanings[], strokes }
```

**Unauthenticated on purpose** — shared reference content with no per-user state.

**There is no `locked` field.** The client derives it: a lesson unlocks once every id
in its `prerequisiteLessonIds` appears in `completedLessonIds` from `/me/progress`.
Nothing on the server computes lock state.

### Exercises — bearer

```
GET  /lessons/:id/exercises?attempt=  -> { lessonId, unit, title, attempt, questionCount,
                                           questions: [ <Question> ] }
POST /lessons/:id/exercises/:exerciseId/answer   { optionId: 'opt-N' }  -> 200
     -> { exerciseId, correct, selectedOptionId, selectedValue,
          correctOptionId, correctValue, prompt }
POST /lessons/:id/complete  -> 200
     -> { lessonId, title, cardsCreated, cardsAlreadyPresent,
          xpAwarded, firstCompletion, totalXp }

Question = { exerciseId, type: 'multipleChoice', prompt, promptKind: 'kana',
             question, options: [ { id, value } ] }
```

The exercise set is an **object with a `questions` array**, not a bare array.

Generation is seeded per `(lesson, user, attempt)`, which is why these routes need a
bearer while plain `/lessons` does not. **The same `attempt` always yields the same
questions** — bump it to reshuffle. No answer key is ever sent; `correct` comes only
from the answer endpoint.

`/complete` is idempotent for XP: the full award lands once, a smaller practice award
on every repeat. `firstCompletion` says which happened, so don't infer it from
`cardsCreated`.

### Reviews — bearer

```
GET  /reviews/due  -> { count, totalDue, cap,
                        cards: [ { cardId, state, due, reps, lapses,
                                   item: <ResolvedItem> } ] }
POST /reviews/:cardId/grade   { grade: 'again'|'hard'|'good'|'easy' }  -> 200
     -> { cardId, grade, state, due, intervalMinutes, reps, lapses,
          stability, difficulty, xpAwarded, totalXp }
```

Also an object wrapping the array, not a bare array. `totalDue` is the true count and
`count` the capped batch, so a client can show "20 of 47".

XP is due-gated: grading a card that was not actually due awards nothing.

### The leak rule, and where it is currently broken

**Never leak `passwordHash` or FSRS internals (`stability`, `difficulty`) to the
client.** The client shows `due` / `intervalMinutes`, not the scheduling math.

`passwordHash` is safe — `toUserResponse` is an explicit allowlist.

⚠️ **`POST /reviews/:cardId/grade` violates this today**: `GradeReviewResponse`
declares and `review.service.ts` returns both `stability` and `difficulty`. Either
drop them from that DTO or amend this rule — but until one of those happens, the
client must not read or display them.

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
