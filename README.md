# GENKŌ

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.

- **`PHASE-0-BLUEPRINT.md`** — the spec. Read it before any architectural decision.
- **`CLAUDE.md`** — workspace rules; each app has its own on top of it.
- **`OPEN-ITEMS.md`** — decisions taken on your behalf, deferred work, and debt.

## Layout

```
api/        NestJS backend + docker-compose.yml
client/     React Native + Expo app (expo-router) — the product
web/        Vite + React public site — the shop window
scripts/    backup + restore-verification (see scripts/README.md)
```

No workspace tooling — each app installs and builds on its own. They are
deliberately **not** npm workspaces: Expo's Metro bundler resolves badly under
hoisting, so `api/`, `client/` and `web/` keep separate `package.json` and
`node_modules`.

## Running it

```bash
cd api
docker compose up -d          # mongo + redis, localhost-only ports
cp .env.example .env          # then fill in the two JWT secrets
npm install
npm run seed                  # loads the Japanese content pack (11 units)
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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:content` | Required seed counts, recommendation slugs, and all versioned stroke assets |
| `npm run audit:prod` | Fail on any production dependency advisory |
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
| `npm run audit:prod` | Fail on new advisories; only the reviewed Expo build-tool IDs are allowed |
| `npx expo export --platform android` | Bundles everything — the fastest way to catch an import error |

There is no test runner in `client/` yet, so `typecheck` and a successful
`expo export` are the gate.

> `npx expo install` is broken under npm 11 in this repo — resolve version pins
> from `bundledNativeModules.json` and add them to `package.json` by hand.

### Audio

Kana and vocabulary prefer pre-generated, immutable course WAV files. Web and
Expo fall back to the device's Japanese voice if a recording is missing, so new
content never leaves a dead play button. AI tutor replies can also be spoken;
only their Japanese text is read. Bare kanji are intentionally silent because a
character's reading depends on its word.

Generate and release-check the full recording pack after seeding the production
database:

```bash
tools/tts-venv/bin/python tools/generate-audio.py --out api/storage/audio
tools/tts-venv/bin/python tools/generate-audio.py --out api/storage/audio --verify-only
```

See `tools/README.md` for model setup and deployment.

### The website

```bash
cd web
npm install
cp .env.example .env          # VITE_API_URL -> the API
npm run dev                   # http://localhost:5173
```

**Set `CORS_ORIGINS` in `api/.env` to this site's origin**, or the page loads and
then fails to fetch anything. The API sends no CORS headers by default, which is
how it behaved before the site existed — the Expo app never needed them, because
a native fetch is not subject to the same-origin policy.

Browsing the course needs no account. Signing in adds the part that teaches:
lesson quizzes, spaced review, XP and streak — the same account and the same
database as the Android app, so progress made in one shows in the other.

Browser access and refresh credentials live in secure HttpOnly, SameSite cookies;
unsafe cookie-authenticated requests also require the double-submit CSRF token.
The native app continues to use SecureStore bearer credentials. Both surfaces use
the same account-backed lessons, review schedule, progress, and account state.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run lint` | Zero-warning oxlint gate |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run test:e2e` | Playwright signup → verification → onboarding browser journey |
| `npm run audit:prod` | Fail on any production dependency advisory |
| `npm run build` | Vite build, TypeScript, and entry-budget gate |

`web/CLAUDE.md` carries its rules, including the one that matters most: glass
surfaces are translucent, **text never is**, and every contrast ratio in
`theme.css` is computed rather than estimated.

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

Every path below is also served under **`/v1`** (ADR-007) — `/lessons` and
`/v1/lessons` are the same handler. The bare path is pinned to v1 rather than
aliased to the newest version, so a build that predates versioning keeps working
after a `/v2` exists. `/` and `/health` are unversioned and answer bare only.

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

### The daily summary (T1.8)

`daily` also carries `reviewsDone` and `lessonsDone`, so the home screen can say
what the learner *did* rather than only what it scored. XP alone is ambiguous —
30 XP is three lessons or fifteen reviews — and "0 of 50 XP today" reads the same
whether nothing has happened or the reviews are done against a high goal.

Both are counted from the **event log** (`review.graded`, `lesson.completed`),
which has been accumulating since M4, and on the learner's local day using the
same `localDateString` helper and the same `now` as `xpToday`.

**They can disagree with `xpToday` after a timezone change, and the counts are
the ones to trust.** `xpToday` compares the *stored* `lastStudyDate` — written
under whatever zone was in effect at the time — against local today, so changing
zone can make it read 0 for a day that had work in it. These counts re-derive from
event timestamps and are unaffected. Caught while verifying T1.8 live: one account
reads `xpToday: 0` in Pacific/Kiritimati and `16` in Pacific/Niue while both
counts hold at `reviewsDone: 3, lessonsDone: 1`. It is the same root cause as
OPEN-ITEMS #18, and within a fixed zone all three agree.

`AnalyticsService.countTodayByType` fetches a **48-hour window and filters by
local date string** rather than issuing a Mongo range query from local midnight.
A range query needs the *instant* of midnight in an IANA zone, which means
deriving a UTC offset, and getting that wrong across a DST boundary is precisely
the bug class item #18 documents. The window covers every zone from UTC−12 to
UTC+14, a learner's day is a handful of rows, and the existing `{userId, ts}`
index serves it. This is a per-user daily count and deliberately not a foundation
for §13's funnel reads, which want a real aggregation.

The app shows it as one quiet line under the XP sentence — "2 lessons and 5
reviews today", or "Nothing studied yet today" on an empty day rather than
"0 reviews, 0 lessons", which reads as a scoreboard of failure on the first
screen someone opens.

## Deployment

Live on the laptop, public via Tailscale Funnel:

**API:** https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/langapp
**Web:** https://aakash-ideapad-3-15iml05-u-1.tail7a4203.ts.net/learn

Same pull-based pattern as the other projects here — see `~/deploy/README.md`.
A systemd user timer polls `origin/main` every minute; on a new commit it resets
the deploy clone at `~/deploy/langapp`, rebuilds, and restarts the services.

| Piece | Where |
|---|---|
| Deploy clone | `~/deploy/langapp` (read-only deploy key) |
| Deploy script | `~/deploy/langapp-deploy.sh` (builds `api/` and `web/`) |
| API service | `langapp-api.service` → `node dist/main` from `~/deploy/langapp/api` on **:7702** |
| Web service | `langapp-web.service` → `vite preview` from `~/deploy/langapp/web` on **:7703** |
| Timer | `langapp-deploy.timer`, every 60s |
| Funnel mounts | `/langapp` → `127.0.0.1:7702`, `/learn` → `127.0.0.1:7703` |

See `deploy/` for the web service unit template and install steps.

```bash
systemctl --user status langapp-api          # is the api up
systemctl --user status langapp-web          # is the web up
journalctl --user -u langapp-api -f          # api logs
journalctl --user -u langapp-web -f          # web logs
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
- **Mail smoke and alerting:** set `MAIL_SMOKE_TO` to an operations-owned inbox,
  then an administrator can `POST /admin/mail/smoke`. It traverses the same API,
  Redis queue, worker, retry policy, and provider used by verification/reset mail.
  Terminal jobs are retained and make `/health` return degraded/503 until they
  are investigated, so the existing health monitor is the alerting connection.
- **Production requires `GEMINI_API_KEY`, working mail, `MAIL_SMOKE_TO`,
  `CONTACT_TO`, and `CORS_ORIGINS`.** `validateEnv` refuses to boot a public
  process that would advertise AI chat, accept a registration it cannot verify,
  discard support messages, or reject the browser origin. Development keeps
  those integrations optional.
- **Mongo and Redis are shared with dev** and owned by
  `~/Projects/langapp/api/docker-compose.yml`. Never `docker compose up` from the
  deploy clone — that file pins `name: langapp`, so it resolves to the *same*
  project from anywhere and would recreate the containers underneath the dev
  stack. The deploy script only `docker start`s them.

  A consequence worth knowing: **`npm run seed` in dev seeds production too.**
  There is one database. New content is live the moment it is seeded locally,
  without waiting for a deploy — and a bad seed is live just as fast.
- Registration is **open to the internet** by choice. See OPEN-ITEMS #1/#3 for
  what that exposes. There are real accounts in the database now, not just test
  ones — which is why the backup below stopped being optional.

## Backups

Nightly at 03:20 via `langapp-backup.timer`, into `~/langapp_backups`, keeping
14 days. **Every archive is restored and counted before it is accepted**, and
deleted if it will not restore — an unverified backup is a belief, not a
safeguard.

```bash
scripts/backup.sh              # run one now
scripts/verify-restore.sh      # restore the newest into a scratch database
systemctl --user status langapp-backup.timer
```

Production must set `REQUIRE_OFFSITE_BACKUP=1` and configure either
`LANGAPP_CLOUD_SYNC_CMD` or `LANGAPP_CLOUD_SYNC_DIR`. The backup service then
fails if the verified archive cannot be transferred off-device; directory copies
are byte-compared before success. Details are in `scripts/README.md`.

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

Multiple choice only (Milestone 3), over **three answerable item kinds**:

| Lesson items | Prompt | Options | `promptKind` |
|---|---|---|---|
| kana | the character | romaji | `kana` |
| vocab | the word | English glosses | `vocab` |
| grammar | a sentence with a `＿` gap | particles and endings | `grammar` |

All three reduce to the same `Choice { id, prompt, answer }`, which is why each
new kind cost a mapping rather than a parallel code path — kanji would slot in
the same way. A lesson with none of them still 422s rather than returning an
empty quiz, and a grammar point with no example is skipped rather than asked
about with an empty prompt.

**Grammar's question text is per-item, and that is not cosmetic.**
「わたしはいき＿。」is grammatical with ます, ません *and* ました — only the English
gloss says which is meant, so the question carries it: `Which fills the gap? —
"I went to the sea."` That is why `QuestionStyle.question` is a function of the
choice rather than a constant string.

`promptKind` exists so the client can size the prompt: a kana prompt is one
glyph and goes in a genkouyoushi cell, a word does not fit in one. Without it
the client would be guessing from string length.

**Nothing is stored.** Generation is a pure function of `(lessonId, userId,
attempt)` plus content, seeded through a small PRNG. Two consequences:

- refreshing mid-session returns the identical set — same questions, same option
  order — because the same inputs reproduce it;
- answering re-derives the set server-side and grades against it, so **no answer
  key is ever sent to the client** and there's no store to expire.

`attempt` is a query param; bumping it is how a client asks for a fresh shuffle.
Distractors are real answers drawn from other items **in the same unit**,
deduped by the answer text — Japanese has distinct kana sharing a reading (じ/ぢ
are both "ji"), and two words can share a gloss; two identical options would
make a question unanswerable. The vocabulary seed is tested for gloss
uniqueness for the same reason.

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
https://aistudio.google.com/apikey and set `GEMINI_API_KEY` in `api/.env`.
Without a key the API boots fine and chat routes answer 503.

**Verified end to end 2026-07-22.** A learner writing `watashi ha Aakash desu`
got hiragana back with romaji and a gloss, plus a correction of は/wa — the same
mistake the seed's own romaji test guards against, caught live.

**`GEMINI_MODEL` is an alias, and that is deliberate.** Pinned names both retire
and get swamped, and on the first real run both happened at once:

| Model | Result on the free tier, 2026-07-22 |
|---|---|
| `gemini-3.5-flash` | 503 `UNAVAILABLE` — "high demand", six times running |
| `gemini-2.5-flash` | 404 — "no longer available" |
| `gemini-flash-latest` | 200 |

So the default is `gemini-flash-latest`, which tracks whatever flash model
Google is actually serving. To see what a key can use:

```bash
curl -s https://generativelanguage.googleapis.com/v1beta/models \
  -H "x-goog-api-key: $GEMINI_API_KEY" | grep '"name"'
```

A 503 from the provider currently surfaces to the learner as a 502 with no
retry — see OPEN-ITEMS #28.

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

`npm run seed` loads **eleven units — 208 kana, 802 words, 12 grammar points, 104
kanji, 90 lessons** — each item with a `KnowledgeNode`, chained via
`prerequisiteLessonIds`.

It starts with `hiragana-basics` and `katakana-basics`: 92 characters, both base
kana tables in full, 10 lessons.

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

A third unit, `vocab-basics`, adds **58 words in 6 themed lessons**, chained
after katakana.

**Every word is spelled using only the 92 characters the kana units teach** —
no dakuten, handakuten, small kana or long mark, because a learner arriving here
has been taught none of them. `src/seed/japanese/vocab.spec.ts` enforces that
rather than trusting it, and it caught three words on the first run: たべる,
ありがとう and ください all need marks that come later. That rule is also why
みず, ともだち, がくせい and every katakana loanword are absent.

Every word and every grammar example also carries **romaji**, shown up to N4 and
dropped from N3 on — by then reading kana is the skill, and latin beside it is a
crutch nobody drops unaided. It is authored rather than generated, because a kana
lookup table is wrong exactly where it matters: は as a topic marker is `wa`, を is
`o`, and こんにちは is `konnichiwa`, not `konnichiha`. `romaji.spec.ts`
transliterates and compares anyway, so a typo fails the build while the real
exceptions stay listed and visible.

`lemma` and `reading` are identical throughout, which is not a placeholder —
ねこ is a correct way to write 猫, and kana-only is how these words are presented
until kanji are taught. When kanji arrive, `lemma` gains the kanji spelling and
`reading` is already right, which is exactly why §5 keeps the two fields apart.

Two more units, `hiragana-marks` and `katakana-marks`, add **58 syllables each**:
dakuten (が), handakuten (ぱ) and yōon (きゃ). Nothing there is a new glyph except
the small ゃゅょ — a learner is not memorising 116 new shapes, they are learning
three rules, which is why it is a separate unit rather than more rows on the base
table.

**They come after the vocabulary unit, not before it.** Folding them into the
base units would be better in the abstract — you would finish hiragana entirely
before starting katakana — but it puts twelve more lessons between someone and
the first Japanese word they can read, and the vocabulary unit was built to need
none of it.

Two romaji collisions are deliberate and tested for: じ/ぢ are both `ji`, ず/づ
both `zu`. The exercise generator already deduplicated distractors by answer text
— written expecting exactly this — so a question about ぢ never also offers じ.

**っ and ー are absent.** Both are marks rather than syllables: っ doubles the
following consonant and has no reading of its own, ー lengthens the preceding
vowel. Neither can answer "which romaji matches this character", which is the
only question this app can ask today. They are why がっこう and コーヒー are still
unreadable — see OPEN-ITEMS.

**Update 2026-07-26:** Two more units, `hiragana-marks-extra` and
`katakana-marks-extra`, now teach っ and ー — one lesson each, six words,
typed romaji. がっこう (gakkou), きって (kitte), コーヒー (koohii),
テーブル (teeburu). The lesson prompts the word and the learner types the
reading; the grader exact-matches so a missed doubled consonant or vowel is
the wrong answer rather than a near-miss.

**Then `vocab-everyday` — 220 words in 14 themed lessons (T1.6, 2026-07-26),
the largest unit in the pack.** It is the unit the marks made possible: by here
a learner knows **151 distinct characters**, effectively all of kana, so the
words the first unit had to leave out arrive at last — たべる, ともだち, がくせい,
みず, おかあさん, ぎゅうにゅう, and loanwords from パン to パソコン. Fifteen words
a lesson rather than ten, since a learner reaching lesson 35 is no longer meeting
their first Japanese word; the verb and adjective lessons carry twenty, because
those are the two groups where having more to compare is what makes each stick.

Two limits remain, both enforced by `vocab-everyday.spec.ts` rather than trusted:
**the small vowels ぁぃぅぇぉ / ァィゥェォ and ヴ are never taught by any unit**, so
フォーク and パーティー are still unspellable and look deceptively like beginner
words; and **っ before ち is avoided**, because the transliterator's doubling rule
yields `ccha` where Hepburn writes まっちゃ as `matcha` — one exception not worth
carrying. The spec also refuses any lemma an earlier unit owns, which is what
keeps はな "nose" from silently overwriting はな "flower": `lemma` is the key the
seed upserts on.

Last comes `grammar-basics`: **12 points in 4 lessons** — です/は/か, polite verb
endings, the particles that go with verbs, and noun-linking. Quizzed by filling
a gap: 「わたし＿せんせいです。」with は / を / に / の to choose from, which tests
using a particle where matching a title to its definition would only test having
read the definition.

That needed a sentence to put a gap in, so `GrammarPoint` gains an `examples`
array — the second documented departure from §5's schemas, after `SrsCard`.
Every sentence is checked by `grammar.spec.ts` against three rules: only taught
kana (no っ or ー, which were still untaught at the time), only words from the
vocabulary unit or conjugations this unit teaches, and at most 16 characters —
Japanese does not space its words, and short sentences are what make that
survivable.

**Last of all, `kanji-basics` — 104 characters in 10 themed lessons (T1.7,
2026-07-26).** It is placed last so it can be a *re-reading* rather than a
memorisation slog: **every kanji in it writes a word the learner already knows in
kana.** 山 is not a new glyph, it is how やま — learned in the first words unit —
is really written; 学 and 校 are the two halves of がっこう; 食 is the 食 in
たべる. Each entry lists the seeded words it writes and `kanji.spec.ts` checks
every one against the actual vocabulary, so the unit cannot drift into teaching
characters for words the course never taught. It caught たべもの on 物 the first
time it ran — a plausible word, and not one this course teaches.

The unit asks **kanji → meaning, and never kanji → reading.** A kanji has several
readings and which one applies depends on the word: 山 is やま alone and サン in
火山, and both are right, so "which reading is this?" would have two correct
answers — the same defect the grammar unit hit with 「わたしはいき＿。」. Readings
are still taught: `GET /lessons/:id` returns `on` and `kun` and the lesson screen
shows them. They are study material, not an answer key.

**Last of all, `vocab-n5` — 512 words in 32 themed lessons (2026-07-27).** JLPT
N5 is conventionally about 800 words and 100 kanji; the kanji side was already
there, but the vocabulary was 290, roughly a third of the level. This unit takes
the course to **802 words**, which is N5's vocabulary complete.

It sits after grammar and kanji rather than beside the other vocabulary, and that
is a pedagogical call: slotting 32 lessons in before grammar would push the first
grammar lesson from 49 to 81, so a learner would meet eight hundred words before
being shown how to put two of them in a sentence. Depth belongs on top of a
complete course, not in the middle of one.

The whole curriculum is one chain: hiragana → katakana → first words → hiragana
marks → katakana marks → hiragana marks-extra → katakana marks-extra →
everyday words → grammar → kanji → the rest of N5, **90 lessons across 11 units**, each unit's
first lesson gated on the previous unit's last. Grammar comes after all the words
because its sentences are built from them, and kanji after everything because it
depends on the whole vocabulary above it.
Every write is an upsert on a natural key, so re-running preserves `_id`s — which
matters because SRS cards will reference them.
