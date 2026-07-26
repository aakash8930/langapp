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

**CORS is off unless `CORS_ORIGINS` is set** (added 2026-07-22 for `web/`). Empty
by default, so the internet-facing deployment stays shut unless deliberately
opened; when set it is an explicit origin allowlist, never `*`, and
`credentials: false` — auth here is a Bearer token a client sends deliberately,
never an ambient cookie a hostile page could ride on. The Expo app is unaffected:
a native fetch is not subject to the same-origin policy, which is why this went
unnoticed until a browser tried.

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
  vocab   { kind, id, lemma, reading, romaji?, gloss, pos, jlpt }
  grammar { kind, id, title, jlpt, explanation,
            examples: [ { sentence, answer, romaji?, gloss } ] }
  kanji   { kind, id, char, on[], kun[], meanings[], strokes }
```

**Unauthenticated on purpose** — shared reference content with no per-user state.

`romaji` was added 2026-07-22. It is **authored, not derived** — transliterating
kana mechanically is wrong exactly where it matters: は as a topic marker is
`wa`, を is `o`, and こんにちは is `konnichiwa`. A lookup table prints
`konnichiha` and contradicts the lesson teaching the rule. `romaji.spec.ts`
transliterates and compares anyway, so every divergence has to be a listed
exception rather than a typo.

For grammar it transcribes the **completed** sentence, so it must never be shown
beside the gapped one in a quiz — it contains the answer.

Optional because the display rule is **romaji up to N4, none after**. That rule
lives with the clients (`web/src/romaji.ts`, `client/lib/romaji.ts`), not the
server: the data stays complete and each surface decides.

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

Question = { exerciseId, type: 'multipleChoice', prompt, promptKind,
             question, options: [ { id, value } ] }
```

`promptKind` is `'kana' | 'vocab' | 'grammar'` (widened twice on 2026-07-22, as
the vocabulary and grammar units landed; it was `'kana'` only). It says what the
prompt *is* so the client can size it — one glyph belongs in a genkouyoushi cell,
a word does not fit in one, a sentence has to wrap. A lesson with none of the
three kinds still 422s.

| Lesson items | Prompt | Options | `question` |
|---|---|---|---|
| kana | the character | romaji | constant |
| vocab | the word | English glosses | constant |
| grammar | a sentence with a `＿` gap | particles and endings | **carries the English gloss** |

**Grammar's `question` is per-item and load-bearing.** 「わたしはいき＿。」is
grammatical with ます, ません *and* ました, so the question text states which
meaning is wanted: `Which fills the gap? — "I went to the sea."` Without it the
question has three right answers. Kana and vocab questions are still constant.

`GrammarPoint.examples` is a **documented departure from §5** (the second, after
`SrsCard` — see OPEN-ITEMS #15 and #26). §5's GrammarPoint has nowhere to put a
sentence, and a grammar quiz has to ask about something. Approved before it was
made. The gap marker is `＿` (U+FF3F), exactly one per sentence.

`GET /lessons/:id` returns `examples[].answer` — that is study material, not a
leak. The **exercise** payload still carries no answer key: `toPublicQuestion` is
an allowlist and never sees the grammar point.

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
          xpAwarded, totalXp }
```

Also an object wrapping the array, not a bare array. `totalDue` is the true count and
`count` the capped batch, so a client can show "20 of 47".

XP is due-gated: grading a card that was not actually due awards nothing.

### Chat — bearer

```
POST /chat/sessions   { scenario? }  -> 201
     -> { id, scenario, title, titleJa, startedAt,
          messages: [ <ChatMessage> ] }        // exactly one: the scripted opener

POST /chat/sessions/:id/messages   { text }  -> 200
     -> { sessionId, corrections: [ <Correction> ], reply: <ChatMessage> }

ChatMessage = { id, role: 'user'|'assistant', text, corrections, createdAt }
Correction  = { span, fix, note }              // span = exact substring the learner wrote
```

Added 2026-07-21 (§14 step 7 — the last Phase 0 item). `scenario` defaults to
`first-meeting`, the only scenario so far; an unknown id is a 400. `text` is
1–500 chars — the cap is a §8 cost guard, not a UX rule.

**One LLM call per turn**: the reply and the correction pass come back together
(§7 steps 4+5, "same call"). `corrections` always describe the message the
learner *just sent*, and are also persisted onto that user message — the
assistant reply never carries corrections. Session opener is scripted, not
generated, so creating a session costs zero tokens.

There is **no GET for chat history** — §9 lists exactly these two routes. The
client keeps the transcript in memory for the life of the screen; a session
abandoned mid-way is simply left behind and a new one started.

The provider is **Gemini free tier** behind `AiOrchestratorService` (Stage A,
§8: ₹0), and it has been **verified against a real model** (2026-07-22). With
`GEMINI_API_KEY` unset every chat turn is a **503** and the rest of the API is
unaffected.

`GEMINI_MODEL` should stay an alias (`gemini-flash-latest`). Pinned names retire
*and* get swamped: `gemini-2.5-flash` now 404s as "no longer available", and
`gemini-3.5-flash` returned 503 UNAVAILABLE six times running on the free tier
the day the key was added. A provider 503 currently surfaces as a 502 with no
retry — OPEN-ITEMS #28. Provider failures surface as **502**, provider rate
limits as **429** — the client should show "try again shortly", not retry-loop.
A session hard-caps at 50 messages (400 past that). Chat routes are throttled
separately from auth (`CHAT_THROTTLE_*`, default 10 per 60s) — also a 429, so
the client cannot tell throttle from provider limit and shouldn't try.

### The leak rule

**Never leak `passwordHash` or FSRS internals (`stability`, `difficulty`) to the
client.** The client shows `due` / `intervalMinutes`, not the scheduling math.

`passwordHash` is safe — `toUserResponse` is an explicit allowlist. `stability`
and `difficulty` are kept off `GradeReviewResponse` for the same reason:
omitting them from the DTO is what makes "we don't send them" the property of
the contract, not a property the code could quietly lose. Resolved 2026-07-26
(T1.3) — see OPEN-ITEMS #21.

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
