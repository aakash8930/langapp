# Open items — things worth your attention

Decisions I made on your behalf, trade-offs I took, and things deliberately
deferred. Nothing here is broken; it's the list of places where a reasonable
person could choose differently, plus the bills that come due later.

Ordered by when they'll bite you. Last updated after Milestone 6.

---

## Decide soon (before the learning loop lands)

### 20. RESOLVED (2026-07-21) — `npm run seed` could not boot

Fixed by adding `JwtModule.register({ global: true })` to `SeedRootModule`, and
verified by running the seed rather than by reasoning about it: it boots, loads
all 46 kana, and a second run leaves every `_id` byte-identical (checksummed
before and after) — which is the property that actually matters, because
SrsCards reference those ids.

The original report follows, because the *shape* of the bug is worth keeping:
a module boundary that resolves only by accident of what `AppModule` happens to
register globally.

---

Found while verifying the XP fix; **pre-existing**, and confirmed by running it
on a clean checkout of the previous commit. Not caused by that work.

```
UnknownDependenciesException: Nest can't resolve dependencies of the
JwtAuthGuard (?, ConfigService). Please make sure that the argument JwtService
at index [0] is available in the ContentModule module.
```

`src/seed/seed.ts` builds a cut-down `SeedRootModule` — Mongo plus the content
modules, deliberately no Redis and no HTTP. But `ContentModule` now pulls in
`JwtAuthGuard`, which needs `JwtService`. In `AppModule` that resolves because
`JwtModule.register({ global: true })` is there; `SeedRootModule` never registers
it, so the seed dies at boot.

**Cost of getting it wrong:** high the moment you need it. The dev database is
already seeded, so nothing is visibly broken day to day — which is exactly why
this went unnoticed. A fresh clone, a wiped volume, or a restore test cannot
load content at all. Task 2's restore verification will hit this.

**Fix:** one line — add `JwtModule.register({ global: true })` to
`SeedRootModule`'s imports. I did not apply it, because it is outside the task
that found it and the seed path deserves its own verification rather than a
drive-by change. *(Applied 2026-07-21, with that verification — see above.)*

**Still true, and worth watching:** nothing in CI or the test suite boots the
seed, so the next module-boundary regression of this kind will be just as
invisible. The cheapest guard is a test that constructs `SeedRootModule` and
asserts it resolves; the honest guard is the restore test in item 6.

### 18. Changing timezone backwards across the date line resets the streak

Found while verifying Milestone 6. `lastStudyDate` is stored as a local
'YYYY-MM-DD' string, so it's only meaningful relative to the tz that was in
effect when it was written. A user who studies in Asia/Kolkata and then moves
to Pacific/Niue (UTC−11) can have `lastStudyDate` = the 19th while their new
local today is the 18th — neither today nor yesterday, so `nextStreak` treats
it as a gap and resets to 1.

Verified live: same stored document reads `xpToday: 22` in Pacific/Kiritimati
and `0` in Pacific/Niue. The read side is *correct* — that user genuinely
hasn't earned XP on their local 18th. It's the write side that would reset a
streak the learner didn't actually break.

**Cost of getting it wrong:** low, and it needs a real tz change plus a
date-line crossing to trigger. Lifetime `xp` is never affected, only the streak.
**Options:** treat "today or later" as same-day (`lastStudyDate >= today` →
unchanged), which makes the streak monotonic under tz changes; or store the
instant alongside the date string and re-derive. I did neither — the milestone
scoped the tz work to comparing local date strings, and both fixes invent
policy about what a streak *means* when a learner moves.

### 1. `/lessons` endpoints are unauthenticated

`api/src/content/lesson.controller.ts` has no `JwtAuthGuard`. Reasoning: lessons are
shared reference content with no per-user state, and §9 lists them without an
auth marker. But Stage A puts them on a public Funnel URL, so anyone with the
link can enumerate your whole content pack.

**Cost of getting it wrong:** low — content is not secret, and there's no AI
spend behind these routes. Mostly it's scraping.
**Fix:** one line — `@UseGuards(JwtAuthGuard)` on the controller. Note this
changes the verify flow, since every lesson read then needs a token.

### 2. One rate limit covers all three auth routes

`AUTH_THROTTLE_LIMIT=10` per 60s applies equally to register, login and refresh.
Login is the actual brute-force target and arguably deserves something tighter
than register.

**Fix:** named throttlers in `ThrottlerModule` config, then `@Throttle({...})`
per route. ~15 lines. I didn't do it because it invents policy you didn't ask
for.

### 3. Rate limiting fails **open** when Redis is down

`RedisThrottlerStorage.increment` catches errors and returns "not blocked"
(`api/src/common/throttler/redis-throttler.storage.ts`). A Redis outage therefore
disables rate limiting rather than locking everyone out of login.

That's the right default for a solo app where Redis going down shouldn't mean
nobody can log in — but it means **a Redis outage is also a security event**,
not just an availability one. `/health` reports Redis down, which is where you'd
notice. Reconsider if the AI endpoints (real per-request cost) end up behind the
same limiter — there, failing open spends money.

### 4. Refresh rotation has no reuse-detection *family* revocation

Replaying a consumed refresh token gets a 401 (verified). But the industry-standard
hardening is: on detecting reuse, revoke *every* refresh token for that user,
because a replay means the token probably leaked.

`RefreshTokenStore.revokeAll(userId)` already exists and is tested-adjacent but
unwired. **Fix:** call it in the `!consumed` branch of `AuthService.refresh`.
Worth doing before real users.

---

### 0b. RESOLVED (pre-client) — grading the same card repeatedly awarded XP each time

`POST /reviews/:cardId/grade` could be called back to back and paid `XP_PER_REVIEW`
every time — the same farming hole as #0, by a different route.

**Fix:** `ReviewService.grade` now reads `card.due <= now` *before* handing the
card to ts-fsrs, and awards XP only when it was genuinely due. Grading a card
that isn't due still reschedules, because that was never the broken part — the
library already plateaus intervals correctly, and there's a test pinning it.
Chosen over a rate limit, which would only have slowed the exploit down while
also blocking a learner legitimately racing through a due queue.

One consequence worth knowing, decided here rather than left implicit:
`UserService.awardXp` is also where the streak advances, so the not-due path
does **not** call it with 0. Calling it would have let a learner hold a streak
by re-grading one card forever — a smaller copy of the hole being closed. The
response still reports `totalXp`, read through `UserService.findById`.

Verified live: grading a due card awarded 2 XP and moved `due` +10 minutes; an
immediate re-grade awarded 0 while still moving `due` out to +2 days.

### 0. RESOLVED (pre-client) — XP was re-awarded on every completion, so it could be farmed

`POST /lessons/:id/complete` awarded a flat `XP_PER_LESSON_COMPLETION = 10` every
time it was called. Cards were idempotent; **XP was not.** A loop of eight curl
requests earned 80 XP.

**Fix:** option (2) from the original list, which got cheap once `lessonCompletions`
existed. `recordCompletion` switched from `updateOne` to `findOneAndUpdate(...,
{ new: true })` and returns the document *after* the `$inc`. Full XP is awarded
when `timesCompleted === 1`, and `XP_PER_LESSON_PRACTICE` (env var, default 2)
on every completion after that.

Two details that matter more than they look:

- The decision comes from the **completion counter**, not from `cardsCreated > 0`
  (option 1). A learner can already hold every card in a lesson via an
  overlapping lesson, which would make a genuine first completion look like a
  replay and silently underpay it. There's a test for exactly that case.
- Reading the counter from the write itself is what makes it concurrency-safe.
  Mongo assigns the value, so two racing first completions get 1 and 2 — exactly
  one can be the first. A read-then-write would let both see 1 and both pay full.

The response now carries `firstCompletion: boolean` alongside `xpAwarded`, so a
client can show a different summary without inferring it from `cardsCreated`.

`learning.service.spec.ts`'s "still awards XP on a repeat completion" — the test
that pinned the old behaviour — is now "awards only the practice amount on a
repeat completion".

Verified live: the same lesson completed three times awarded 10, then 2, then 2.

**Note on the config split:** `XP_PER_LESSON_PRACTICE` is an env var but
`XP_PER_LESSON_COMPLETION` is still a code constant, so the pair now lives in two
places. That's what was asked for, and the practice award is the one worth tuning
without a redeploy, but if you ever want both tunable, move them together rather
than adding a second one-off.

### 4a. `attempt` is client-supplied, so a learner can reroll a quiz

`GET /lessons/:id/exercises?attempt=N` takes the attempt number from the client.
Bumping it reshuffles. That's harmless today — you can't reroll into an easier
question, since every set covers the same items and the answer is never in the
payload — but it means the server has no idea which attempt a learner is *really*
on.

**Milestone 4 should own this**: when `POST /lessons/:id/complete` exists, the
attempt counter becomes per-user learning state, and the exercise route should
read it rather than trust the query param. Leaving it client-supplied now avoided
inventing a learning-module schema a milestone early.

---

## Deferred by design (blueprint says [Later], noted so they aren't forgotten)

### 5. No `DELETE /me`

§10 is explicit that you should build true erasure *before* you need it — DPDP
(India, applies to you now) and GDPR (the moment you have an EU user) both
require it. `revokeAll` covers the Redis side; the Mongo side needs a real
cascade once SrsCards, chat messages and events exist. **It gets harder with
every milestone.** Cheapest moment to write it is right after the collection
that would need cascading gets created.

### 6. MOSTLY RESOLVED (2026-07-22) — backups exist, but on the same disk

`scripts/backup.sh` runs nightly at 03:20 under a systemd user timer
(`langapp-backup.timer`, `Persistent=true` so a sleeping laptop catches up
rather than skipping). Keeps 14 days. `scripts/verify-restore.sh` restores any
backup into a scratch database on demand.

**Every archive verifies itself at creation** — it is restored and counted
before it is accepted, and deleted if it will not restore. The first version of
the script counted the live database instead, and the counts disagreed within
seconds because a user was completing lessons while it ran; the verification
caught it on its first run. Counts describe the archive, never the live system.

**Still open, and why this is "mostly":** §11 asks for a *cloud-synced* folder
and no sync client is installed here, so `~/langapp_backups` shares a disk with
the database. This protects against a bad seed, a dropped collection, and a
corrupted database — not against losing the disk. Closing it is one env var
(`LANGAPP_BACKUP_ROOT`) plus a sync client; see `scripts/README.md`.

**The deadline stated here has passed.** This item used to say "the only thing
in Mongo is seed data you can regenerate, so the real deadline is the first real
user account you'd be sad to lose." There are now **21 accounts**, including
ones that are not mine, with review cards attached. Seeded content regenerates
with `npm run seed`; accounts and their scheduling state do not. The backup
script fails loudly if an archive contains no users while the database has
some, for exactly that reason.

### 19. RESOLVED (client M0–M5) — the frontend pause ended

Paused through six API milestones on Aakash's "wait for now" (2026-07-19), then
resumed the same day. Built as **React Native + Expo** in `client/` — not the
Next.js of blueprint §3 nor the Flutter of §11, because the target is a phone
and Expo Go removes the build-and-sideload step entirely.

Shipped: auth, home with lesson lock state, the exercise flow, the review
session, settings, and (C2, 2026-07-21) the AI chat screen. `client/CLAUDE.md`
holds its rules.

**Never exercised against a real model.** C2 was verified by typecheck, a
successful `expo export`, and the API's 503/400/404 paths — but no chat turn
has ever round-tripped through Gemini, because `GEMINI_API_KEY` is unset. The
reply bubble, the correction note, and the pending skeleton have therefore been
*rendered* but never *filled with real output*. Expect to tune the bubble's
handling of long replies (the tutor's romaji-plus-gloss format is verbose) the
first time it runs for real.

Two API changes were needed for M5 and were approved before being made: a write
path for `dailyGoalXp`, and `'system'` added to the theme enum. Both are in the
root CLAUDE.md contract.

### 21. `POST /reviews/:cardId/grade` violates the leak rule

`GradeReviewResponse` declares — and `review.service.ts` returns — `stability`
and `difficulty`. The root CLAUDE.md says FSRS internals must never reach the
client, so the API is in violation of its own rule.

Nothing is exploitable; the cost is that the contract says one thing and the code
does another, which is how a rule stops being enforced at all.

The client is **not** relying on it: `client/api/reviews.ts` deliberately types
`GradeResult` without the two fields, so they cannot be rendered by accident. So
dropping them from the DTO is a safe, client-invisible change whenever you want
it. The alternative is to amend the rule and say scheduling internals are fine to
send — but then say so, rather than leaving both.

### 22. Time zone can only be set to the device's zone

`client/app/(app)/settings.tsx` shows the stored zone and offers one tap to adopt
the device's. There is no IANA picker — a 400-entry scroller felt like the wrong
shape for a single-learner Phase 0, and the server accepts any valid zone anyway.

Consequence: a learner who wants a zone that is neither their stored one nor
their device's cannot set it from the app. `PATCH /me/settings { tz }` still
takes anything the runtime's tz database knows.

### 7. No age gate, privacy policy, or ToS

§13 item 5. Language apps pull in minors whether or not you target them. Tiny
now, painful to retrofit after launch.

### 8. No "report a mistake" affordance

§13 item 2 calls confidently teaching *wrong* Japanese the existential risk of an
AI-content language app. The content pipeline is currently seed-file-only and
hand-checked, so the risk is near zero **today** — it becomes real the moment
any content is AI-generated. Add the report action before that milestone, not
after.

---

## Technical debt / judgement calls

### 9. The prerequisite graph is character-to-character, so edges grow quadratically

`SeedService.linkPrerequisiteNodes` links every character in lesson N to every
character in lesson N+1. The count has tracked every content milestone: 150 edges
for 25 characters → 360 for 46 → 720 for 92 → **1614 for 208** (2026-07-22).
Still fine at this scale, and the adjacency-list design is exactly what §5
prescribes.

**The count is no longer the strongest argument against it.** The marks units
made the semantics visibly wrong: the last yōon lesson alone writes 144 edges
asserting that ぴょ requires りょ, which is not true in any sense — they are
siblings in a table, taught together for convenience. The graph is now recording
lesson packaging as though it were conceptual dependency.

**The fix when it hurts:** a node per *row* (or per lesson) and link those
instead of individual characters — turns 1614 edges into 42, and stops the graph
claiming things that aren't so. I left it literal because §5's "prerequisites of
X" query wants character granularity, and premature graph abstraction is harder
to undo than to add — but the marks units are the point where that trade starts
looking wrong.

### 10. `npm run seed` is destructive-safe but not idempotency-tested in CI

Every write is an upsert on a natural key, and I verified re-running preserves
`_id`s (this matters — SrsCards will reference them from Milestone 3 onward). But
nothing *enforces* that; a future contributor could add a plain `create()` and
break it silently. A test asserting "seed twice, ids unchanged" would lock it in.

### 10a. Exercise generation lives in `content`, not `learning`

`ExerciseService` sits in the content module. Reasoning: it's a pure function of
content with **no per-user state persisted** — `userId` is only a shuffle seed —
and §5 describes `exerciseTypes` as part of the Lesson definition ("an ordered
set of items + an exercise recipe"), which content owns.

The seam to watch: once Milestone 4 tracks attempts, XP and SRS cards, that state
belongs to `learning`, and learning will call `ContentService`/`ExerciseService`.
If exercise generation starts *needing* learner state (adaptive difficulty,
weighting toward weak items), that's the signal it should move to `learning` and
call content for the item pool instead. Cheap to move now, expensive later.

### 10b. Multiple choice only asks kana → romaji

**Mostly resolved 2026-07-22**: the service answers three kinds now — kana →
romaji, word → gloss, and grammar as fill-in-the-blank (item 26). Only
`KanjiEntry` still 422s, and there is no seeded kanji to ask about anyway.

The grammar question turned out to fit the existing machinery after all: a
gapped sentence is just a prompt whose answer happens to be a particle. What it
needed was content (a sentence to gap) rather than a new question shape.

Original report follows.

`ExerciseService` filters lesson items to `kind === 'kana'` and throws 422 if none
remain. Lessons made of vocab, grammar or kanji items therefore can't generate a
quiz yet, even though `exerciseTypes` would allow it. Fine while the only seeded
unit is Hiragana; it's the first thing to extend when vocabulary lands.

Also note the reverse direction (show romaji, pick the kana) doesn't exist —
recognition and recall are different skills, and only one is being tested.

**Katakana made that reverse direction harder, not just absent** (2026-07-21).
`a` is now the correct answer for both あ and ア, so a romaji→kana question has
two right answers unless it is scoped to one script. Since distractors already
come from the unit pool, and a unit is one script, the scoping is free — but it
has to be deliberate. The forward direction is unaffected: the prompt is a
glyph, and a glyph belongs to exactly one script.

### 10c. Option count degrades silently on a small unit

If a unit can't supply 3 distinct distractors, questions come back with fewer
than 4 options rather than erroring. Chosen so a thin content pack can't break a
learner's session. There's a test pinning the behaviour, but nothing warns you —
a 2-option quiz would just quietly be easy.

### 15. RESOLVED (M5) — SrsCard carries one field beyond §5

`SrsCard.learningSteps` was added, with your sign-off. Measured justification:
without it a card re-enters learning step 0 on every grade and never graduates —
pinned at "due in 10 minutes" indefinitely, making progressive intervals
impossible.

`elapsed_days` and `scheduled_days` are **not** stored — derivable from
`lastReview`/`due`, and deriving beats a field that can drift. `learning_steps`
is the only one that can't be derived, which is exactly why it's the only one
added.

Kept here because it's the one documented divergence from §5's data model: if you
ever diff the blueprint against the schema, this is the difference and it's
deliberate.

### 16. Lesson completion is not gated on prerequisites or on actually answering

`POST /lessons/:id/complete` succeeds for any lesson at any time. It does not
check `prerequisiteLessonIds`, and it has no idea whether the learner answered a
single exercise — the M3 answer endpoint records nothing. You can complete
lesson 3 first, having answered nothing.

Fine for a vertical slice; wrong for a shipped product. Both fixes want the same
missing piece: a record of exercise attempts, which is Milestone 5-ish territory.

### 17. Analytics writes are synchronous

`AnalyticsService.record()` writes to Mongo inline, adding a round trip to every
completion. §7 wants this on a Redis/BullMQ queue and off the request path. The
failure semantics are already correct (a failed write can't fail the completion,
guarded in both learning and analytics), so moving it to a queue later is a
swap, not a redesign.

### 11. `strictPropertyInitialization` is off

In `tsconfig.json`. Required for the Mongoose/NestJS decorator pattern (schema
class properties are assigned by the ODM, not the constructor). Standard for
NestJS, but it does mean a genuinely uninitialized property won't be caught.

### 12. No eslint / prettier

Deliberate — four more dev deps, and your CLAUDE.md says ask first. The codebase
is hand-formatted consistently so far. It will drift.

### 13. Mongo runs on host port **27018**, not 27017

Your machine has a system-level `mongod` on 27017. `docker-compose.yml` maps
27018 to avoid the clash. If you ever wonder why `mongosh` connects to the wrong
database, this is why. `MONGO_URI` in `.env` already points at 27018.

### 14. `isolatedModules` is on, which changes what the compiler catches

Added in Milestone 1 because ts-jest was type-checking the whole program per test
file (3s → 50s test runs). It transpiles per-file instead, and `npm run typecheck`
is the real type gate.

**This has already bitten once and will again:** in Milestone 2, every
union-typed `@Prop` (`jlpt`, `script`, `theme`, …) needed an explicit
`type: String`, because `emitDecoratorMetadata` can't resolve an imported union
type without whole-program context. The app worked but the *tests* couldn't load
the schema. **Rule of thumb: every `@Prop` whose TS type is a union or an
imported type needs an explicit `type:`.** All current schemas comply.

---

## Not yet built (Phase 0 roadmap, §14)

| Step | Status |
|---|---|
| 1. Auth + user | done (M1) |
| 2. Content seed: one Hiragana unit | done (M2) |
| 3. One exercise type (multiple choice) | done (M3) |
| 4. `POST /lessons/:id/complete` → seeds SrsCards + XP | done (M4) |
| 5. `GET /reviews/due` + grade with `ts-fsrs` | done (M5) — **the loop closes here** |
| 6. Streak + daily goal on `/me` | done — was already live when this table said "next"; the table was stale |
| 7. One AI text chat scenario | done (2026-07-21) — `chat` + `ai-orchestrator` modules, Gemini free tier |

| 8. Second exercise type → voice → Katakana → the rest | **next**, and now the only thing left |

**§14 steps 1–7 are complete** on both the API and the client. What remains is
step 8, which is breadth rather than machinery.

`exerciseTypes: ['multipleChoice']` is seeded on all five lessons and
`ExerciseService` now honours it — a lesson that doesn't list `multipleChoice`
gets a 422 rather than a quiz.

### Content status against §1

§1 wants "Hiragana → Katakana → basic vocabulary → basic grammar". One of the
four is done:

| Track | State |
|---|---|
| Hiragana | **complete** — all 46 base characters, 5 lessons (2026-07-21) |
| Katakana | **complete** — all 46 base characters, 5 lessons, gated behind hiragana (2026-07-21) |
| Basic vocabulary | **first unit complete** — 58 words, 6 themed lessons (2026-07-22) |
| Basic grammar | **first unit complete** — 12 points, 4 lessons (2026-07-22) |
| *(kana marks — not a §1 line)* | **complete** — 116 syllables, 12 lessons (2026-07-22) |

**§1's content line is complete.** All four tracks exist, plus the marks unit
that §1 does not ask for. What remains is depth, not coverage.

Three follow-ups the marks unit created rather than closed:

- **A second vocabulary unit is now unblocked and is the obvious next content.**
  The first one was capped at words avoiding dakuten; たべる, ありがとう, みず,
  ともだち and the katakana loanwords are all readable now. The unblock is real
  but currently theoretical — nothing uses it yet.
- **§7's chat still uses a static word list** (item 23). Vocabulary exists in the
  KnowledgeGraph as `vocab` nodes, so the retrieval that item describes is
  finally possible; it was not before.
- **っ and ー are still untaught** — see item 25.

### 27. The website keeps auth tokens in localStorage (2026-07-22)

An XSS on `web/` steals a session. There is no browser equivalent of the app's
expo-secure-store — every web storage API is readable by any script on the page.

**Why it is tolerable now:** the site renders no user-generated content, loads
no third-party script (Google Fonts is a stylesheet, not JS), and React escapes
by default. There is nothing to inject through.

**What changes the answer:** a comment box, an analytics snippet, an embed, or
any user content rendered as HTML. Any one of those should arrive together with
the fix rather than before it.

**The fix, and why it was not done now:** httpOnly cookies, which script cannot
read. It is an API change with a tail — the server issues and clears cookies,
CORS needs `credentials: true` and therefore a single strict origin rather than
a list, and CSRF protection becomes mandatory the moment the browser attaches
credentials on its own. That is a security redesign, not a storage swap, and it
was not worth blocking the first usable version of the site on.

**Cost of getting it wrong:** one learner's account. Registration is open and
these accounts hold no payment details or personal data beyond an email and
chat transcripts (#24) — which is not nothing, and is the reason this is
written down rather than shrugged at.

### 25. っ and ー cannot be taught by the only exercise this app has (2026-07-22)

The marks units teach dakuten, handakuten and yōon but deliberately skip the
sokuon (っ) and the chōonpu (ー). Both are marks rather than syllables: っ doubles
the following consonant and has no reading of its own, ー lengthens the preceding
vowel. `KanaItem.romaji` is required and a multiple-choice question asks "which
romaji matches this character" — neither has an answer, and inventing one
("(double)") makes a question whose odd-one-out is guessable without knowing
anything.

**Cost of getting it wrong:** がっこう (school), きって (stamp), コーヒー (coffee)
and テーブル (table) remain unreadable, and those are common words. This is the
one remaining gap between "knows the kana" and "can read Japanese text".

**Fix:** a second exercise type — most likely "read this word" over short words
that contain the mark, which teaches the rule in the only context where it means
anything. That is §14 step 8's "second exercise type".

*(Grammar turned out **not** to have this problem — fill-in-the-blank fit the
existing multiple-choice machinery. See item 26.)*

### 26. GrammarPoint carries an `examples` field beyond §5 (2026-07-22)

The second documented departure from §5's schemas, after `SrsCard` (item 15).
**Approved before it was made**, with the alternative measured.

§5's `GrammarPoint` is `{ title, jlpt, explanation }`. A grammar quiz has to ask
about *something*, and the only question this app generates is multiple choice.
The useful multiple-choice question about a particle is "which one fills this
gap", which needs a sentence with a gap — and nothing in §5 can hold one.

The alternative was matching a title to its definition, which needs no schema
change but tests whether you can recognise a definition you have read rather
than whether you can use the particle, and puts four paragraphs on screen as
options. **Both were offered; fill-in-the-blank was chosen, with
definition-matching kept as a later second exercise type.**

Consequences, all additive: `examples: [{ sentence, answer, gloss }]` on the
schema, the same on `ResolvedItem`'s grammar arm, and `promptKind` gaining
`'grammar'`. Documented in the root CLAUDE.md contract.

**One thing to watch:** the gloss inside the question text is load-bearing, not
decoration. 「わたしはいき＿。」is grammatical with ます, ません and ました alike.
Any future exercise type over grammar has the same problem, and dropping the
gloss would silently make questions unanswerable rather than merely harder.

**The learning loop is closed as of M5**: complete a lesson → cards seeded →
`/reviews/due` → grade → FSRS reschedules → XP and events accumulate. Steps 1–5
of §14 work. §14's own test is whether it "feels good" enough to use daily —
that's now answerable by actually using it.

Still disconnected: the M3 exercise endpoint. `POST .../answer` grades a
multiple-choice question but records nothing — it awards no XP and doesn't touch
the SRS card for that item. So a learner's *exercise* answers and their *review*
grades are two unrelated systems. Wiring "got it wrong in an exercise" into
"schedule that card sooner" is the obvious next connection, and §7 step 7 assumes
it exists ("schedule missed words into SRS").

### 23. Chat is wired to the LLM but not to the learning loop (2026-07-21)

Three deliberate gaps in the §14-step-7 build, all consequences of what exists
today rather than oversights:

- **Corrections don't touch SRS.** §7 step 7 says "schedule missed words into
  SRS", but a correction `span` is free text — mapping it to a KnowledgeNode
  needs vocab content and fuzzy matching that doesn't exist yet. Same class of
  gap as the exercise/SRS disconnect above.
- **Target words are static** in `ai-orchestrator/scenarios.ts`. §7 step 2 says
  retrieve them from the KnowledgeGraph; the graph holds only kana today, so a
  lookup would return nothing. Swap when a vocab pack is seeded.
- **No chat XP.** A chat turn emits `chat.turn` analytics but awards nothing.
  Blueprint doesn't specify chat XP; decide deliberately rather than defaulting
  to yes (it's the one surface where "farm XP" meets "costs provider quota").

**Cost of getting it wrong:** low now, grows with content. None of these block
using the chat daily.

### 24. Chat transcripts widen the PII surface (2026-07-21)

§10's PII inventory now includes chat transcripts (`chatMessages`), and there is
no `GET` to read them back nor any deletion path — they're write-only rows that
outlive the session's usefulness. Fine for Stage A with known testers; item 5's
`DELETE /me` must erase them when it lands, and a retention window is worth
deciding before strangers sign up. Message content is deliberately never logged
(`GeminiProvider` logs status codes only).

---

## Environment note (not a code issue)

`npm test` timings swing wildly on this machine — the same suite measured 5.9s
and 22s on consecutive runs. Load average was ~11 on 4 cores, with roughly 20
Docker containers plus a browser competing. Jest spawns a worker per core and
thrashes. If it gets annoying, `npm test -- --maxWorkers=2` is usually *faster*
under contention. Nothing in the codebase changed to cause it.
