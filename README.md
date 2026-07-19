# langapp

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.

- **`PHASE-0-BLUEPRINT.md`** — the spec. Read it before any architectural decision.
- **`CLAUDE.md`** — project rules and conventions.
- **`OPEN-ITEMS.md`** — decisions taken on your behalf, deferred work, and debt.

## Running it

```bash
docker compose up -d      # mongo + redis, localhost-only ports
cp .env.example .env      # then fill in the two JWT secrets
npm install
npm run seed              # loads the Hiragana content pack
npm run start:dev         # api on :3000
```

Generate the JWT secrets with `openssl rand -base64 48` — they must be at least
32 chars and different from each other, or the app refuses to boot.

> **Mongo is on host port 27018**, not the default 27017, because a system-level
> `mongod` commonly occupies 27017. See `docker-compose.yml`.

| Command | What it does |
|---|---|
| `npm run start:dev` | API with watch mode |
| `npm run seed` | Loads the Japanese content pack (idempotent) |
| `npm test` | Unit tests |
| `npm run typecheck` | `tsc --noEmit` — the real type gate (see OPEN-ITEMS #14) |
| `npm run build` | Production build |

## Architecture

One NestJS app, modules matching future service boundaries (§4 of the blueprint).
**A module never touches another module's collections** — cross-module access
goes through the owning module's exported service class. That single rule is what
makes later extraction cheap.

```
src/
  auth/              register / login / refresh, argon2id, rotating refresh tokens
  user/              users collection, /me, embedded profile+gamification+settings
  content/           kana, vocab, grammar, kanji, lessons + exercise generation
  knowledge-graph/   knowledgeNodes + knowledgeEdges (adjacency list, no graph DB)
  learning/          srsCards, lesson completion (XP via UserService)
  analytics/         append-only events (write path only)
  seed/              npm run seed
  health/            GET /health with live Mongo + Redis checks
  common/            JwtAuthGuard, Redis-backed throttler storage
  redis/             global RedisService (ioredis)
  config/            env validation, runs at boot
```

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | — | 200 ok / 503 degraded, with live dependency checks |
| `POST` | `/auth/register` | — | rate limited |
| `POST` | `/auth/login` | — | rate limited |
| `POST` | `/auth/refresh` | — | rate limited; single-use rotating token |
| `GET` | `/me` | Bearer | never returns `passwordHash` |
| `PATCH` | `/me/settings` | Bearer | partial update of audioSpeed / theme / tz |
| `GET` | `/lessons?unit=` | — | ordered by unit then order |
| `GET` | `/lessons/:id` | — | resolves `itemRefs` into full item documents |
| `GET` | `/lessons/:id/exercises?attempt=` | Bearer | multiple-choice set; no answer key in the payload |
| `POST` | `/lessons/:id/exercises/:exerciseId/answer` | Bearer | `{ optionId }` → correct/incorrect + the right answer |
| `POST` | `/lessons/:id/complete` | Bearer | seeds SRS cards, awards XP, emits `lesson.completed` |
| `GET` | `/reviews/due` | Bearer | due cards with content resolved, capped at 20 |
| `POST` | `/reviews/:cardId/grade` | Bearer | `{ grade }` — again/hard/good/easy through ts-fsrs |

Quick smoke test:

```bash
curl -s localhost:3000/health
curl -s "localhost:3000/lessons?unit=hiragana-basics"

TOKEN=$(curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-enough-password","displayName":"You"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['tokens']['accessToken'])")

curl -s localhost:3000/me -H "Authorization: Bearer $TOKEN"
```

## Data model notes

Follows §5 of the blueprint. Two things worth knowing:

**`KanaItem` is not in §5.** It was added in Milestone 2 because §5's
`Lesson.itemRefs.kind` and `KnowledgeNode.kind` both already list `'kana'` — kana
was always meant to be its own kind rather than a vocabulary word. Kept minimal
(`kana`, `romaji`, `script`, `row`, `order`, `conceptId`); stroke counts and audio
keys arrive with the features that need them. `script` already covers katakana,
so that's a seed change rather than a migration.

**The knowledge graph is an adjacency list**, per §5 — two collections, no graph
database. `KnowledgeNode.refId` points at a content document; that document's
`conceptId` points back. "What are X's prerequisites" is one indexed lookup.

**Every `@Prop` with a union or imported type needs an explicit `type:`.** See
OPEN-ITEMS #14 — this has bitten once already.

## Exercise generation

Multiple choice only (Milestone 3). Shows a kana character, offers four romaji.

**Nothing is stored.** Generation is a pure function of `(lessonId, userId,
attempt)` plus content, seeded through a small PRNG. Two consequences:

- refreshing mid-session returns the identical set — same questions, same option
  order — because the same inputs reproduce it;
- answering re-derives the set server-side and grades against it, so **no answer
  key is ever sent to the client** and there's no store to expire.

`attempt` is a query param; bumping it is how a client asks for a fresh shuffle.
Distractors are real readings drawn from other characters **in the same unit**,
deduped by romaji — Japanese has distinct kana sharing a reading (じ/ぢ are both
"ji"), and two identical options would make a question unanswerable.

Question order is deliberately shuffled, unlike `GET /lessons/:id` where item
order is pedagogical and preserved. A quiz is not the lesson.

## Lesson completion

`POST /lessons/:id/complete` does three things, in order:

1. **Seeds SRS cards** — one per lesson item the user doesn't already have,
   initialised via `ts-fsrs`'s `createEmptyCard()` so the zero values match what
   the scheduler expects at first review. All start `state: 'new'`.
2. **Awards XP** through `UserService.awardXp()` — `$inc`, so concurrent awards
   accumulate rather than overwrite. Learning never touches the `users`
   collection.
3. **Emits `lesson.completed`** into the append-only `events` collection.

Repeating a completion creates no new cards. Two layers enforce that: a
read-then-filter against existing cards (the common path), and a unique index on
`{userId, itemRef.kind, itemRef.id}` that catches anything racing past it —
verified with 8 simultaneous requests.

Step 3 is guarded at both ends: cards and XP are already committed by then, so a
failed analytics write logs and moves on rather than turning a successful
completion into a 500. §7 puts analytics off the request path for this reason;
the BullMQ version is [Later].

## The review loop

This is the core of Phase 0 (§6). `ts-fsrs` owns every scheduling decision —
nothing in this repo computes an interval.

- **`GET /reviews/due`** — `{ userId, due: { $lte: now } }` sorted by `due`,
  capped at 20 (§6: sessions must be bounded). Served entirely by the
  `{ userId: 1, due: 1 }` index: `explain()` shows `IXSCAN` with **no in-memory
  SORT stage**, because the compound index provides the ordering too. Returns
  `totalDue` alongside the capped batch so a client can render "20 of 47".
- **`POST /reviews/:cardId/grade`** — `{ grade: again|hard|good|easy }`. Loads
  the card, hands it to `fsrs.next()`, persists stability, difficulty, due,
  state, reps, lapses and lastReview, awards XP, emits `review.graded`.

Measured behaviour, grading `good` each time the card falls due:

```
good  learning  due in 10 min      good  review  due in  7.0 days
good  review    due in 24.0 hr     good  review  due in 19.0 days
good  review    due in  2.0 days   good  review  due in 48.0 days
```

And the four grades on a fresh card: `again` 1 min · `hard` 6 min · `good`
10 min · `easy` 8 days.

### Why SrsCard has one field §5 doesn't

`learningSteps`. `ts-fsrs` tracks position in its learning-step sequence
(default 1m → 10m) in a field that **cannot be derived** from anything else on
the card. Without persisting it, a card re-enters step 0 on every grade and never
graduates out of Learning — it sits at "due in 10 minutes" forever, which makes
progressive intervals impossible. This was measured, not assumed.

`elapsed_days` and `scheduled_days` are deliberately *not* stored: both are
derivable from `lastReview`/`due`, and deriving them can't drift out of sync.

`learning/fsrs-card.mapper.ts` is the single point where ts-fsrs's snake_case /
numeric-enum representation meets §5's camelCase / string-state one.

## Seeded content

`npm run seed` loads the `hiragana-basics` unit: rows あ–な as 25 `KanaItem`s,
each with a `KnowledgeNode`, chained into 3 lessons via `prerequisiteLessonIds`.
Every write is an upsert on a natural key, so re-running preserves `_id`s — which
matters because SRS cards will reference them.
