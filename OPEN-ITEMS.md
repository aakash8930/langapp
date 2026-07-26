# Open items — things worth your attention

Decisions I made on your behalf, trade-offs I took, and things deliberately
deferred. Nothing here is broken; it's the list of places where a reasonable
person could choose differently, plus the bills that come due later.

Ordered by when they'll bite you. Last updated after T1.6.

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

**A second symptom of the same root cause, found verifying T1.8 (2026-07-26):**
`daily.xpToday` and `daily.reviewsDone`/`lessonsDone` disagree after a tz change.
`xpToday` compares the *stored* `lastStudyDate` against local today, so it reads 0
for a day the learner worked; the T1.8 counts re-derive from event timestamps and
stay correct. Measured on one account: `xpToday: 0` in Pacific/Kiritimati and `16`
in Pacific/Niue, with `reviewsDone: 3, lessonsDone: 1` in both.

That makes the event-derived counts a small argument for the "store the instant
and re-derive" option below — they demonstrate it works and costs little. Within a
fixed zone nothing disagrees, which is why this stays a low-priority edge.

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

**RESOLVED 2026-07-22 — the chat now runs against a real model.** A key was
added and a turn round-tripped: hiragana back, romaji and gloss per sentence,
and two corrections including は/wa. See README "The AI chat".

Still true and worth checking on a device: the reply bubble has only ever been
*rendered*, never filled with real output. The tutor's
hiragana-plus-romaji-plus-gloss format is verbose — three parenthesised
translations in one reply is normal — so expect the bubble to need tuning for
length the first time you see it on a phone.

Two API changes were needed for M5 and were approved before being made: a write
path for `dailyGoalXp`, and `'system'` added to the theme enum. Both are in the
root CLAUDE.md contract.

### 21. RESOLVED (T1.3, 2026-07-26) — `POST /reviews/:cardId/grade` violated the leak rule

`GradeReviewResponse` and `review.service.ts` no longer declare or return
`stability` / `difficulty`. The contract and the code agree; the client types
already didn't have them, so the change is invisible to phone and web. The
comments that said "the API is in violation" have been rewritten in
`client/api/reviews.ts`, `web/src/api.ts`, `web/CLAUDE.md`, and the root
`CLAUDE.md` so the next reader does not re-add the fields by accident.

Found while writing #28; **pre-existing**, and the cost of leaving it was only
that the contract was self-contradictory.

The original report follows, for the shape of the bug.

`GradeReviewResponse` declared — and `review.service.ts` returned — `stability`
and `difficulty`. The root CLAUDE.md said FSRS internals must never reach the
client, so the API was in violation of its own rule.

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

**RESOLVED (T1.7, 2026-07-26)**: `KANJI_STYLE` answers the fourth kind — kanji →
meaning — and `kanji-basics` seeds 104 characters for it. All four item kinds in
`RESOLVABLE_KINDS` are now quizzable, so nothing 422s for want of a style.

Deliberately **kanji → meaning and not kanji → reading**: 山 is やま alone and
サン in 火山, so a reading question has two right answers. Same defect as
grammar's gap, and the reason the meaning is the only thing this shape asks.

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

### 30. The events collection now has a read path, and it is not an aggregation (T1.8, 2026-07-26)

`AnalyticsService` was write-only by design — §5 calls `events` "append-only,
write-heavy, never updated" and §13's funnel reads are [Later]. T1.8 needed
"how many reviews did this learner do today", which is genuinely a read of that
log, so `countTodayByType` exists now.

It is deliberately the *small* version: one user, one day, a 48-hour window
filtered in memory by local date string. That choice buys correctness across
timezones without offset arithmetic (see #18 for why that matters), and it is
honest at this scale — a learner's day is a handful of rows.

**What it is not:** a foundation for analytics. The moment a question spans users
or a longer period ("activation funnel", "week-over-week retention"), this shape
is wrong and wants a real Mongo aggregation with the `{type, ts}` index. The
method doc says so, but the risk is that the next daily-ish number gets bolted on
here because it is the closest thing available.

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
| 7. One AI text chat scenario | done — modules 2026-07-21, **verified against a real model 2026-07-22** |

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
| Basic vocabulary | **two units complete** — 58 words in 6 lessons (2026-07-22) plus 220 words in 14 lessons (T1.6, 2026-07-26) |
| Basic grammar | **first unit complete** — 12 points, 4 lessons (2026-07-22) |
| *(kana marks — not a §1 line)* | **complete** — 116 syllables, 12 lessons (2026-07-22) |
| *(kanji — a Phase 1 line, not §1)* | **first unit complete** — 104 characters, 10 lessons (T1.7, 2026-07-26) |

**§1's content line is complete.** All four tracks exist, plus the marks unit
that §1 does not ask for. What remains is depth, not coverage.

Three follow-ups the marks unit created rather than closed:

- ~~**A second vocabulary unit is now unblocked and is the obvious next
  content.**~~ **Done (T1.6, 2026-07-26): `vocab-everyday`, 220 words in 14
  themed lessons.** The unblock is no longer theoretical — たべる, ともだち,
  がくせい, みず and the loanwords are all in it. See item 29 for the one quality
  issue the size of the unit exposed.
- **§7's chat still uses a static word list** (item 23). Vocabulary exists in the
  KnowledgeGraph as `vocab` nodes, so the retrieval that item describes is
  finally possible; it was not before.
- ~~**っ and ー are still untaught**~~ — resolved by T1.1, see item 25.

### 29. A big unit makes multiple-choice easier, not harder (2026-07-26)

Found while verifying T1.6, and it is a *consequence* of that unit rather than a
pre-existing bug.

Distractors come from the whole **unit** pool (`findUnitVocabPool`), not the
lesson. That was fine at 58 words across 6 themed lessons and is visibly wrong at
220 across 14: the live quiz for チーズ came back offering "two", "an answer" and
"library". Every distractor is from a different theme, so a learner eliminates
three options on category alone without knowing the word. A themed lesson in a
themed unit is exactly where this bites.

**Cost of getting it wrong:** low but real — it inflates the correct-answer rate
without teaching anything, which quietly corrupts the SRS signal too, since
`/complete` seeds cards for items the learner may only have guessed.

**The fix, not applied:** prefer distractors from the same lesson and fall back to
the unit when a lesson cannot supply three. ~10 lines in `distractorPool`'s
caller. Not done here because it changes generated questions for **every** unit
including the seeded, deterministic ones — every existing `(lesson, user,
attempt)` triple would produce a different quiz — and that is a behaviour change
to exercise generation, not part of authoring a content unit. Worth doing
deliberately, with the option-count floor of item 10c in mind: a 15-word lesson
can supply 3 same-theme distractors comfortably, but the 6-word marks-words
lessons cannot, which is exactly why the fallback is required rather than
optional.

### 28. RESOLVED (T1.2, 2026-07-26) — provider 503 retried with bounded backoff

`GeminiProvider.post` now retries a provider 503 up to `MAX_ATTEMPTS = 3`
times with backoff `[1s, 2s]` before mapping to 502. The 503-vs-502 distinction
the client relies on is preserved: the API's *own* 503 (no `GEMINI_API_KEY`)
still surfaces as 503 to the client, and only provider-side 503s are retried.

400, 404, 429 and 500 are explicitly not retried. 400/404 fail identically
forever, 429 is a quota that a retry makes worse, 500 is broader than the
transient 503 we know how to handle. Four new tests in
`gemini.provider.spec.ts` pin the policy: retry-then-success, retry-then-give-up,
429-no-retry, 500-no-retry.

The latency budget is now up to ~3s on the worst case (backoff 1s + 2s plus
two extra round-trips). §8's "a few seconds, not instant" still holds; the
chat composer already waits on a real LLM call and is disabled while one is
in flight. Verified live on the deployed API: a first turn that 502'd in T1.10
on a single attempt round-trips on a retry.

Found while verifying T1.10; **pre-existing**, and the live test caught it
the moment the first real turn went out.

The original report follows.

`GeminiProvider` used to map any non-ok response to a 502 and give up. That
is fine for a 400 or a 404, which will fail identically forever — but **503
is the one upstream error that is worth retrying**, and on the free tier it
is common: `gemini-3.5-flash` returned `UNAVAILABLE` six times in a row while
`gemini-flash-latest` answered immediately.

**Cost of getting it wrong:** a learner mid-conversation gets "the AI tutor hit
an error" for something that would have worked on the next attempt. Switching to
the alias made it much less likely, but did not remove it — any free-tier model
can be swamped for a minute.

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

### 25. RESOLVED (T1.1, 2026-07-26) — っ and ー cannot be taught by the only exercise this app has

Second exercise type landed: **`wordReading`**. The prompt is a word
(e.g. がっこう) and the answer is the romaji the learner types. Lives on two new
units — `hiragana-marks-extra` and `katakana-marks-extra`, one lesson each,
gated onto the existing chain between marks and grammar. The grader exact-
matches against the canonical romaji with trim/lowercase/whitespace
normalisation, so "gakou" instead of "gakkou" is *the* mistake the lesson
catches. Two new content groups covered the new words; the romaji
transliterator was extended in the spec to handle っ and ー.

Schema consequences, additive: `Question` becomes a discriminated union
(`multipleChoice | wordReading`); `AnswerExerciseDto` becomes a discriminated
union (`{ optionId } | { text }`) validated with `@ValidateIf`; `PromptKind`
gains `'wordReading'`. Both clients gained a render branch in their lesson
screen. Contract updated in the root CLAUDE.md.

### 26. GrammarPoint carries an `examples` field beyond §5 (2026-07-22)

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

Still partly disconnected: the exercise endpoint. `POST .../answer` **does** record
now — T1.4 added `exerciseAttempts`, with `correct` on each row, to power the
completion gate — but it still awards no XP and still doesn't touch the SRS card
for the item it asked about. So a learner's *exercise* answers and their *review*
grades remain two systems that don't inform each other.

**T1.5 built the mechanism this needs.** `LearningService.scheduleMissedWords`
already does "got it wrong → make that card due sooner, without inventing a
grade", and an exercise answer is a *better* input than a chat correction: it
carries the exact item id, so it needs no text matching and none of the
single-character compromise. Wiring `answer()`'s wrong path to it is the obvious
next connection and is now a small change rather than a design problem.

### 23. Chat is wired to the LLM, and now partly to the learning loop (2026-07-21, updated T1.5 2026-07-26)

Three deliberate gaps in the §14-step-7 build. **The first is now closed**; the
other two remain.

- ~~**Corrections don't touch SRS.**~~ **Done (T1.5, 2026-07-26.)**
  `ChatService.sendMessage` passes both halves of every correction — the learner's
  `span` and the tutor's `fix` — to `LearningService.scheduleMissedWords`, which
  matches them against taught vocabulary via `ContentService.findVocabInTexts`
  and then either creates a card due now or pulls an existing card's `due`
  forward. See below for the three judgement calls it contains.

  **It writes `due` and nothing else.** `stability`, `difficulty`, `state`,
  `reps` and `lapses` are FSRS's model of the learner, and the only honest way to
  move them is a real graded review. Manufacturing a grade from "the tutor
  corrected you" would feed the scheduler an observation that never happened and
  degrade every interval it computes afterwards. So the feature makes a word come
  up sooner; it never claims to know how well the learner knows it. A test pins
  that the update document has exactly one key.

  **Single-character lemmas are never matched, and this is the load-bearing
  compromise.** The vocabulary contains に ("two"), ご ("five"), め ("eye") and
  て ("hand") — and に/ご are two of the commonest particles in the language. A
  correction about a particle に would otherwise schedule the *number* に, which
  teaches the wrong thing rather than merely wasting a card. Requiring two
  characters costs those four words and removes the entire class of false
  positive. The matching is substring-based because these lemmas are kana-only
  and Japanese has no spaces to tokenise on — there is no morphological analyser
  here and adding one is not a Phase 0 decision.

  **Worth watching: this makes review XP reachable by writing bad Japanese.**
  Pulling a card's `due` forward makes it gradeable, and grading a due card pays
  `XP_PER_REVIEW`. So a learner could deliberately write errors to surface cards
  and earn 2 XP each. Bounded by the chat throttle (10/60s), by provider quota,
  and by only affecting words the correction actually touched — and the learner
  still has to answer the review. Not worth a guard now; worth knowing before
  chat XP (below) is added on top.
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
