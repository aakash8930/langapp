# GENKŌ

AI-native Japanese language learning platform.

- **`RELEASE-CHECKLIST.md`** — mandatory public-MVP acceptance, mail, isolation, backup, and rollback gates.
- **`PLATFORM-AUDIT.md`** — the latest completed platform audit.
- **`api/CLAUDE.md`, `client/CLAUDE.md`, `web/CLAUDE.md`** — app-specific engineering constraints.

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
npm run seed                  # loads the verified Japanese content pack (14 units)
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
| `npm test` | Fast mobile course-path and display-policy tests |
| `npm run typecheck` | `tsc --noEmit`, including mobile tests |
| `npm run audit:prod` | Fail on new advisories; only the reviewed Expo build-tool IDs are allowed |
| `npx expo export --platform android` | Bundles everything — the fastest way to catch an import error |

The mobile gate is `npm test`, `npm run typecheck`, the reviewed production
dependency audit, and a successful Android Expo export.

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
lesson quizzes, checkpoints, XP and streak — the same account and the same
database as the Android app, so progress made in one shows in the other.

Browser access and refresh credentials live in secure HttpOnly, SameSite cookies;
unsafe cookie-authenticated requests also require the double-submit CSRF token.
The native app continues to use SecureStore bearer credentials. Both surfaces use
the same account-backed lessons, progress, and account state.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run lint` | Zero-warning oxlint gate |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run test:e2e` | Fast mocked Playwright signup → verification → onboarding journey |
| `npm run test:e2e:fullstack` | Real browser/API/Mongo/Redis/Mailpit learner loop (requires the CI service stack) |
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
  learning/          lesson completion, attempts, learner evidence, checkpoints
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
(the writes those rules produce). One known edge remains: moving timezone backwards across the date line resets
the streak.

### The daily summary

`daily` carries `lessonsDone`, counted from append-only `lesson.completed`
events on the learner's local calendar day. XP and event counts can briefly
differ because analytics writes are queued; XP remains the synchronous source
for goals and streaks.

## Deployment

### Legacy development deployment

The current laptop/Tailscale topology is useful for development and private
acceptance only; it is not approved for public-MVP traffic until the isolation
and acceptance gates in `RELEASE-CHECKLIST.md` are complete.

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
- **The legacy laptop deployment shared Mongo and Redis with development. That
  topology is not approved for a public MVP.** Production must use distinct
  Mongo, Redis, and storage credentials/instances, and development seeding must
  be unable to change public data. Record the isolation evidence in
  `RELEASE-CHECKLIST.md` before announcing availability.
- Registration is **open to the internet** by choice. Rate limiting, working
  verification mail, monitoring, isolated production data, and verified
  off-device backups are therefore release requirements, not follow-up work.

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

**Every `@Prop` with a union or imported type needs an explicit `type:`.**
Mongoose reflection cannot infer those runtime types reliably.

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

`POST /lessons/:id/complete` verifies prerequisites and a clean exercise
attempt, records an idempotent lesson completion, awards XP through
`UserService`, adds newly taught kana to the learner state, and emits
`lesson.completed`. Repeating a lesson earns the smaller configured practice
award rather than duplicating completion progress.

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

Transient provider 503 responses are retried with a short capped backoff; a
terminal provider failure surfaces to the learner as 502.

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

`npm run seed` currently loads **14 ordered units — 208 kana rows, 929
vocabulary rows, 32 grammar points, 188 kanji entries, and 114 lessons**.
`npm run verify:content` is the canonical release gate for these counts; it also
verifies every recommended starting unit and all deterministic stroke assets.

The prerequisite chain is:

1. `hiragana-basics`
2. `katakana-basics`
3. `vocab-basics`
4. `hiragana-marks`
5. `katakana-marks`
6. `hiragana-marks-extra`
7. `katakana-marks-extra`
8. `vocab-everyday`
9. `grammar-basics`
10. `kanji-basics`
11. `vocab-n5`
12. `vocab-n4`
13. `grammar-n4`
14. `kanji-n4`

The course starts from zero, reaches a complete authored N5 vocabulary, and then
adds the currently available N4 vocabulary, grammar, and kanji. N3–N1 onboarding
choices deliberately fall back to the highest authored N4 starting point rather
than implying that unseeded higher-level lessons exist.

Kana includes the base tables, dakuten, handakuten, yōon, small-tsu doubling,
and the long-vowel mark. Romaji is authored and regression-tested for particle
and word exceptions rather than generated from a naive character lookup.
Kanji exercises ask for meaning, not an isolated reading, because the correct
reading depends on the word in which the character appears.

Every content write is an upsert on a natural key, so re-running the seed keeps
stable document IDs for existing content and lesson references. CI runs the seed twice and
requires identical summaries.
