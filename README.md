# langapp

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.

- **`PHASE-0-BLUEPRINT.md`** — the spec. Read it before any architectural decision.
- **`CLAUDE.md`** — workspace rules; each app has its own on top of it.
- **`OPEN-ITEMS.md`** — decisions taken on your behalf, deferred work, and debt.

## Layout

```
api/        NestJS backend + docker-compose.yml
client/     React Native + Expo app (expo-router)
scripts/    ops scripts — not yet written
```

No workspace tooling — each app installs and builds on its own. They are
deliberately **not** npm workspaces: Expo's Metro bundler resolves badly under
hoisting, so `api/` and `client/` keep separate `package.json` and
`node_modules`.

## Running it

```bash
cd api
docker compose up -d          # mongo + redis, localhost-only ports
cp .env.example .env          # then fill in the two JWT secrets
npm install
npm run seed                  # loads the Hiragana content pack
npm run start:dev             # api on :3000
```

Generate the JWT secrets with `openssl rand -base64 48` — they must be at least
32 chars and different from each other, or the app refuses to boot.

For the AI chat, also set `GEMINI_API_KEY` (free key from
https://aistudio.google.com/apikey — see "The AI chat" below). Optional:
everything except `/chat/*` works without it.

> **Mongo is on host port 27018**, not the default 27017, because a system-level
> `mongod` commonly occupies 27017. See `docker-compose.yml`.

All `npm` commands below run from `api/`.

| Command | What it does |
|---|---|
| `npm run start:dev` | API with watch mode |
| `npm run seed` | Loads the Japanese content pack (idempotent) |
| `npm test` | Unit tests |
| `npm run typecheck` | `tsc --noEmit` — the real type gate (see OPEN-ITEMS #14) |
| `npm run build` | Production build |

### The client

```bash
cd client
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your funnel URL
npx expo start                # scan the QR code with Expo Go
```

The phone talks to the API over the Tailscale Funnel, which has valid TLS — so
there is no cleartext exemption or certificate workaround to configure. Point
`EXPO_PUBLIC_API_URL` at the funnel URL, not `localhost`: the phone is not on
your machine.

| Command | What it does |
|---|---|
| `npx expo start` | Dev server + QR code for Expo Go |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo export --platform android` | Bundles everything — the fastest way to catch an import error |

There is no test runner in `client/` yet, so `typecheck` and a successful
`expo export` are the gate.

> `npx expo install` is broken under npm 11 in this repo — resolve version pins
> from `bundledNativeModules.json` and add them to `package.json` by hand.

### Building the APK

The client is built with EAS Build and sideloaded — **APK, not AAB**: there is no Play
Store listing, and an AAB cannot be installed directly.

```bash
cd client

# One time only. `init` writes extra.eas.projectId into app.json — commit that.
npx eas-cli login
npx eas-cli init

# Commit first: EAS uploads the committed git state, not the working directory.
npx eas-cli build --platform android --profile production
```

EAS offers to generate an Android keystore on the first build. Say yes and let it keep
it — **a later build signed with a different key cannot upgrade over this install**,
Android refuses it, and you have to uninstall and lose the Keychain session first.

When the build finishes, EAS prints a URL and a QR code. Scan it on the phone, download
the APK, and allow "install unknown apps" for the browser when prompted. Or over USB:

```bash
adb install -r <downloaded>.apk
```

Bump `expo.android.versionCode` in `app.json` for each build you want to install over a
previous one. `eas.json` sets `appVersionSource: "local"`, so that number comes from
`app.json` and EAS will not invent one.

**`EXPO_PUBLIC_API_URL` comes from `eas.json`, not `.env`.** `.env` is gitignored, so it
is never uploaded to the build — a cloud build that relied on it would produce an app
that throws "EXPO_PUBLIC_API_URL is not set" on first launch. All three profiles pin the
funnel URL explicitly. Change it there if the funnel hostname ever changes.

The APK talks to the deployed API over the funnel and needs no dev server. It does need
the laptop awake and `langapp-api.service` running — otherwise the app shows its offline
state, which is the intended behaviour, not a crash.

## Architecture

One NestJS app, modules matching future service boundaries (§4 of the blueprint).
**A module never touches another module's collections** — cross-module access
goes through the owning module's exported service class. That single rule is what
makes later extraction cheap.

```
api/src/
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
| `GET` | `/` | — | HTML status page: live dependency state + this route list |
| `GET` | `/health` | — | 200 ok / 503 degraded, with live dependency checks |
| `POST` | `/auth/register` | — | rate limited |
| `POST` | `/auth/login` | — | rate limited |
| `POST` | `/auth/refresh` | — | rate limited; single-use rotating token |
| `GET` | `/me` | Bearer | never returns `passwordHash` |
| `GET` | `/me/progress` | Bearer | XP, level, streak, today vs daily goal, cards due, lessons done |
| `PATCH` | `/me/settings` | Bearer | partial update of audioSpeed / theme / tz / dailyGoalXp |
| `GET` | `/lessons?unit=` | — | ordered by unit then order |
| `GET` | `/lessons/:id` | — | resolves `itemRefs` into full item documents |
| `GET` | `/lessons/:id/exercises?attempt=` | Bearer | multiple-choice set; no answer key in the payload |
| `POST` | `/lessons/:id/exercises/:exerciseId/answer` | Bearer | `{ optionId }` → correct/incorrect + the right answer |
| `POST` | `/lessons/:id/complete` | Bearer | seeds SRS cards, awards XP, emits `lesson.completed` |
| `GET` | `/reviews/due` | Bearer | due cards with content resolved, capped at 20 |
| `POST` | `/reviews/:cardId/grade` | Bearer | `{ grade }` — again/hard/good/easy through ts-fsrs |
| `POST` | `/chat/sessions` | Bearer | starts an AI chat; returns the scripted opener; rate limited |
| `POST` | `/chat/sessions/:id/messages` | Bearer | `{ text }` → reply + corrections; one Gemini call; rate limited |

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

## Streak and daily goal

The streak advances on the **first XP-earning action of a new day in the
learner's own timezone** (`settings.tz`), and resets when a day is missed.

The whole problem is that "a day" is a local calendar concept, not a 24-hour
window, so every comparison happens on `'YYYY-MM-DD'` strings rendered in the
user's zone — never on UTC timestamps. `user/gamification/streak.ts` holds that
arithmetic, kept free of Mongo so it can be tested directly.

Two consequences worth knowing:

- **`todayXp` is corrected on read.** Nothing rewrites the stored counter until
  the next award, so after midnight it still holds yesterday's total.
  `UserService.todayXpFor` returns 0 once `lastStudyDate` no longer matches the
  local today. Reading `gamification.todayXp` directly is a bug.
- **`previousDay` does its arithmetic in UTC on purpose.** Its input is already
  a local calendar date, so this is pure calendar math; using UTC means a DST
  transition (a 23- or 25-hour local day) can't produce an off-by-one.

Streaks are pinned by tests in `streak.spec.ts` (same day / consecutive /
skipped / non-UTC learner, plus DST and leap day) and `user.service.spec.ts`
(the writes those rules produce). See OPEN-ITEMS #18 for the one known edge:
moving timezone backwards across the date line resets the streak.

## Deployment

Live on the laptop, public via Tailscale Funnel:

**https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/langapp**

Same pull-based pattern as the other projects here — see `~/deploy/README.md`.
A systemd user timer polls `origin/main` every minute; on a new commit it resets
the deploy clone at `~/deploy/langapp`, rebuilds, and restarts the service.

| Piece | Where |
|---|---|
| Deploy clone | `~/deploy/langapp` (read-only deploy key) |
| Deploy script | `~/deploy/langapp-deploy.sh` (builds in `api/`) |
| Service | `langapp-api.service` → `node dist/main` from `~/deploy/langapp/api` on **:7702** |
| Timer | `langapp-deploy.timer`, every 60s |
| Funnel mount | path `/langapp` → `127.0.0.1:7702` |

```bash
systemctl --user status langapp-api          # is it up
journalctl --user -u langapp-api -f          # app logs
journalctl --user -u langapp-deploy -f       # deploy logs
```

Notes:

- **Tailscale strips the `/langapp` prefix** before proxying, so the app needs no
  global prefix — `/langapp/me/progress` arrives as `/me/progress`. The flip side
  is that the app cannot know its own public base path, which is why the status
  page at `/` lists endpoints as **plain text and emits no links**: an absolute
  `href` would point at the funnel root (a different service), and a relative one
  would depend on whether the visitor typed a trailing slash.
- **Deploy is push-to-main.** `git push origin main` from here and the laptop
  picks it up within a minute. Nothing else is needed.
- The deploy clone's `.env` is **not in git**, so it survives `git reset --hard`.
  Its JWT secrets are deliberately *different* from the dev ones — that instance
  is internet-facing and this one isn't. Rotating dev secrets does not affect it.
  It lives at `~/deploy/langapp/api/.env`, next to the app's working directory.
  Because it is untracked, **no git operation will move it** — a restructure that
  changes the API's working directory has to move it by hand or the service will
  fail `validateEnv` on restart.
- **Mongo and Redis are shared with dev** and owned by
  `~/Projects/langapp/api/docker-compose.yml`. Never `docker compose up` from the
  deploy clone — that file pins `name: langapp`, so it resolves to the *same*
  project from anywhere and would recreate the containers underneath the dev
  stack. The deploy script only `docker start`s them.
- Registration is **open to the internet** by choice. See OPEN-ITEMS #1/#3 for
  what that exposes.

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

## The AI chat

§14 step 7 — one text scenario (`first-meeting`) through the §7 pipeline. Two
modules, split along §4's seams: `chat` owns `chatSessions`/`chatMessages` and
the routes; `ai-orchestrator` owns prompt assembly and the provider call, so a
Stage B provider swap touches one file (`gemini.provider.ts`).

The provider is **Gemini free tier** (§8: Stage A is ₹0), called with a
hand-rolled `fetch` — no SDK dependency. Get a free key at
https://aistudio.google.com/apikey and set `GEMINI_API_KEY` in `api/.env`
(`GEMINI_MODEL` defaults to `gemini-3.5-flash`). Without a key the API boots
fine and chat routes answer 503.

One call per turn: Gemini's `responseSchema` forces
`{ reply, corrections: [{span, fix, note}] }`, so the conversation turn and the
correction pass (§7 steps 4+5) cost a single request. History is capped at 12
turns and messages at 500 chars — §8's "input tokens are a cost you control".
Corrections are persisted on the learner's message they annotate.

The scenario's 8 target words are static in `ai-orchestrator/scenarios.ts`
because no vocabulary is seeded yet — §7 says retrieve them from the
KnowledgeGraph, which today would return nothing. Swap to a graph lookup when
a vocab pack lands.

On the client (`app/(app)/chat.tsx`), the notable decision is that **React
Query's cache is the transcript store, not a cache** — the API has no history
endpoint, so `['chat','session']` holds the conversation with `gcTime:
Infinity` and every append goes through `setQueryData`. That is what lets an
in-flight turn survive navigating away mid-reply: the promise resolves into the
cache, not into component state. Corrections render as a margin note under the
learner's own bubble, marked in `shu` rather than `danger` — writing a beginner
sentence slightly wrong is the ordinary case in practice, not an error.

## Seeded content

`npm run seed` loads two units — `hiragana-basics` and `katakana-basics` —
**92 characters, both kana scripts in full**, as `KanaItem`s, each with a
`KnowledgeNode`, chained into 10 lessons via `prerequisiteLessonIds`.

Base characters only: no dakuten (が), handakuten (ぱ), yōon (きゃ), or chōonpu
(ー). Those are marks on characters already here, and belong to a later unit
rather than a longer version of this one. Romaji is Hepburn throughout (`shi`,
`chi`, `tsu`, `fu`), because Hepburn is what a learner types.

The two units are the same shape — `src/seed/japanese/kana-pack.ts` defines it,
and each script is a data file filling it in. Adding a third script would be a
new pack in `PACKS`, nothing more.

**The chain runs across units**: katakana's first lesson lists hiragana's last
as its prerequisite, so §1's "Hiragana → Katakana" is a real gate rather than a
display order. The character-level graph edges deliberately stop at the unit
boundary — "ん before ア" is a claim about stages, not characters, and the
lesson prerequisite already makes it.

Distractors are drawn from the unit pool, so a katakana question never offers a
hiragana option, and シ's options naturally include ツ — which is exactly the
discrimination worth drilling.
Every write is an upsert on a natural key, so re-running preserves `_id`s — which
matters because SRS cards will reference them.
