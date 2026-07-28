# Open items — things worth your attention

Decisions I made on your behalf, trade-offs I took, and things deliberately
deferred. Nothing here is broken; it's the list of places where a reasonable
person could choose differently, plus the bills that come due later.

Ordered by when they'll bite you. Last updated after ADR-006 (background jobs).

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

### 5. RESOLVED — `DELETE /me` exists

`AccountDeletionService` cascades across `users`, `srsCards`,
`lessonCompletions`, `exerciseAttempts`, `chatSessions`, `chatMessages`,
`events`, `friendships`, `blocks` and `directMessages`; `reports` and
`leagueStandings` are kept, for the reasons documented at the endpoint in
`CLAUDE.md`. Cross-module deletes run in parallel and the user document goes
last, so a crash mid-cascade leaves consistent data rather than orphans.

This item, and #32 below, both still said it did not exist — the endpoint
shipped without either being updated. Corrected 2026-07-28 with the
documentation pass; see #36.

**Still open from the original concern:** the §10 requirement is erasure the
*learner* can trigger, and this is an API route. Whether either client surfaces
a delete-account action has not been checked here.

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

### 7. PARTLY RESOLVED (slice 5, 2026-07-26) — age gate exists; privacy policy and ToS do not

**The age gate landed** with the social features, because shipping stranger
messaging without one was not an option. `dateOfBirth` is required at
registration, under-13s are refused, and messaging additionally requires a
known age — with **unknown failing closed**, so the 32 accounts predating the
gate cannot message until they supply one.

The minimum is **13, not 18**, and that is a decision worth being able to
defend: the protection against adults reaching minors is structural rather
than age-based — messages are only possible between accepted friends, so no
stranger can open a conversation — plus per-user blocking and reporting.
Busuu and HelloTalk make the same trade. If minor↔adult contact ever needs
restricting outright, `MIN_AGE_FOR_MESSAGING` is the seam, and the schema
already stores what such a check would read.

**Both documents exist since 2026-07-27** — `legal.controller.ts`, served as
markdown at `/privacy` and `/terms` and as JSON at `/legal/privacy` and
`/legal/terms`. This paragraph said they did not until 2026-07-28; see #36 for
how a whole route group went unrecorded.

Reviewing them for accuracy on 2026-07-28 turned up three problems, since the
text is hand-written prose that nothing typechecks:

- It listed **"gem counts"** among the data collected. Gems were deleted in §3.1.
  Fixed, and `legal.controller.spec.ts` now fails if a removed mechanic
  reappears in the legal text.
- It said an account could be deleted "within account settings". **Neither client
  has such a control** — grepping `client/` and `web/` finds nothing calling
  `DELETE /me`. Reworded to name the API and admit the in-app control is not
  there yet.
- It promised deletion of "all associated data" without mentioning that
  **safety reports are retained**. Now disclosed, along with the fact that
  deleting direct messages removes them from the other participant's history
  too.

**Two gaps remain and neither is mine to close.** The contact address is
`support@langapp.example.com`, a placeholder that does not receive mail — a
privacy policy whose data-request channel does not exist is not a working
policy. And erasure is API-only: DPDP expects a mechanism a non-technical
learner can actually use, which means a settings screen, not a `curl`. The
policy is at least honest about that now.

The original report follows.

§13 item 5. Language apps pull in minors whether or not you target them. Tiny
now, painful to retrofit after launch.

### 8. PARTLY RESOLVED — the report route exists; nobody reads the reports

`POST /content/report` takes `{ itemKind, itemId, issueType, description? }` and
files a `contentReports` row. So the affordance §13 item 2 asked for is on the
wire, ahead of any AI-generated content — which was the deadline that mattered.

**But it is write-only, exactly like social reports (#31).** `status` is `'open'`
and nothing in the codebase moves a row to `'reviewed'` or `'resolved'`; the enum
has those values and no route or job uses them. A learner who reports a typo has
no way to learn that anything happened, and the operator has no way to find out
without querying Mongo by hand.

That is tolerable while content is seed-file-only and hand-checked. It stops being
tolerable at the same moment the original note names: **the first AI-generated
content**, because then the report queue is the only thing standing between a
generation bug and a learner being taught something false. Whatever answers #31
should answer this at the same time — one review surface for both report kinds,
not two.

Also unchecked: whether either client actually calls this route.

---

## Technical debt / judgement calls

### 9. RESOLVED (ADR-005 slice 1, 2026-07-28) — the prerequisite graph was character-to-character

The quadratic character-to-character edges are gone, and the lesson layer is now
**derived from the content** rather than written by hand per pack. Measured on a
freshly seeded database:

| | before | after |
|---|---|---|
| lesson nodes | 22 of 90 | **90 of 90** |
| `contains` edges | 208 (kana only) | 1126 (every lesson's items) |
| `prerequisite` edges | 20 (kana chain only) | 89 (every lesson) |
| prerequisite mismatches vs `prerequisiteLessonIds` | not comparable | **0 of 90** |

Two findings from doing it, neither of which was in the original note:

**The half-fix was worse than the count.** Lesson nodes had been added for kana
only — the inline code lived in `seedKanaLessons` and the vocab, grammar and kanji
equivalents were never written — so the graph covered a quarter of the course while
looking finished. `syncLessonGraph` derives the layer from whatever lessons exist,
so a unit cannot be forgotten: adding a pack adds lessons, and lessons are what it
reads.

**Upserting is not enough for derived data.** The old code could only add edges, so
a lesson that lost an item kept its `contains` edge for ever — the same "graph
asserting things that are not so" that ADR-005 is about, arriving from the other
direction. `setEdgesFrom` / `setEdgesTo` declare a *complete* set, so a rebuild
removes as well as adds. Verified by injecting a false `contains` edge and a false
`prerequisite` edge into a seeded database and re-running: both were pruned, counts
back to 1126/89.

`prerequisiteLessonIds` on the lesson document is now the single source of
dependency truth. The old code re-derived the chain from its own loop variable, so
the graph and the lessons could disagree with nothing to notice.

The original note follows.

### 9b. The live graph is two schemes old, and re-seeding is part of deploying (2026-07-28)

**Read this before deploying ADR-005.** The production database still holds the
*first* graph scheme: 1126 nodes with **no lesson nodes at all** and **1614
kana→kana `prerequisite` edges** — the quadratic ones asserting ぴょ requires りょ.
It has never been re-seeded since 9baaa3b.

`npm run seed` is what migrates it, and it does three things that matter here:
`syncIndexes()` replaces the unique `{kind, refId}` index with the partial pair
concepts need, the derived edge types are cleared and rebuilt, and the lesson and
concept layers are written. Expected after: **1270 nodes, 1613 edges**.

**The edge clearing exists because of a bug this nearly shipped with.**
`setEdgesFrom`/`setEdgesTo` declare the complete set of edges *for the nodes they
are called about*, so they cannot remove an edge written by an earlier scheme —
the 1614 kana→kana edges sit between nodes no current pass mentions, and every
one of them would have survived a re-seed. Every scratch database was seeded
fresh, which is exactly why the tests were green: the bug is only reachable from a
database with history. Found by planting 400 kana→kana edges plus 208 orphans into
a seeded database and re-running; all 2221 derived edges were cleared and rebuilt
to 1613, with zero survivors and zero orphans.

Two smaller things worth knowing:

- **Nodes are never pruned.** Only edges are. A node for content that has been
  deleted persists, and edges to it are cleared but the node stays. Harmless
  today — content is only ever added — and it is what keeps `conceptId` on content
  documents stable across seeds, which is the reason not to just rebuild the
  collection.
- **Mongo's `{refId: null}` matches an absent field**, so it cannot be used to
  check the invariant that concepts carry no `refId`. `{refId: {$exists: true}}`
  is the check that means what it says; my first verification query read as 54
  violations when the real answer was 0.

### 9a. What ADR-005 still owes (2026-07-28, updated after slice 3)

Slice 1 fixed the *shape* of the graph, slice 3 added the concept layer. What
remains:

- **`related` is still declared and never created.** The one edge type with no
  producer. It is deliberately excluded from the seed's edge clearing, so anything
  found there was put there by hand.
- **Nothing reads the concept layer yet.** The edges exist and are correct; no
  service queries them. The first intended consumer is the exercise generator
  using `contrasts-with` to choose distractors on purpose rather than by accident
  of the unit pool — that is a change to question generation and belongs in its own
  slice, with the seeded shuffle's determinism preserved.
- **Concept prerequisites do not exist.** Only `contains` (concept → its kana) and
  `contrasts-with` are written. Grammar dependencies — the thing ADR-005 said the
  concept graph unblocks — need concepts that stand for grammatical ideas rather
  than kana rows, and those are not derivable from the packs.

Resolved by slice 3 (2026-07-28), for the record:

- `concept` nodes exist — 54 of them, one per kana row across both scripts and
  both marks packs, derived from the packs so a new row cannot be forgotten.
  Identity is `{lang, slug}` via partial unique index; `refId` stays absent.
- `contrasts-with` exists — 30 authored pairs, 60 directed edges (the relation is
  symmetric and edges are directed, so both directions are written).
- `usesKanji` is populated — 130 edges across 118 words.

**§5.3's own example could not be authored.** It names "が vs は" as a target
contrast; the course teaches は as a topic marker and never teaches が as a subject
marker, so the pair would assert a distinction no lesson draws.
`concepts.spec.ts` rejects it, which is the gate doing its job on the blueprint
rather than on me.

**`usesKanji` is not derivable from lemmas**, which is worth recording because the
obvious approach looks right and silently produces nothing. Vocabulary is stored
in kana by design — the kanji unit is a *re-reading* of known words — so scanning
802 lemmas for taught kanji characters yields **zero** matches. The relation lives
on `KanjiSeed.writes`, whose own comment says it is "not persisted" because §5's
`KanjiEntry` has nowhere to put it. The graph is that home: a relation between two
content documents is what it is for, so authored scaffolding became queryable with
no schema departure.



- **No `concept` nodes.** §5.3's core addition — a node that is an idea rather
  than a content document ("the あ row", "な-adjectives", "the が/は
  distinction"). Blocked on a schema decision: `KnowledgeNode.refId` is required
  with a unique index on `{kind, refId}`, and a concept has no document to point
  at.
- **No `contrasts-with` edges.** §5.3 calls these pedagogically load-bearing —
  シ/ツ, は-as-particle vs は-as-syllable, が vs は — and the exercise generator
  currently gets that discrimination by accident, from unit-pool distractors.
  Needs a list of pairs, which is content authoring rather than code.
- **`related` and `usesKanji` are declared and never created.** Zero edges of
  either type exist. `usesKanji` is not in §5.3's target edge list at all, so it
  is either an unbuilt idea or a leftover; worth deciding rather than leaving.
- **Nothing reads the graph, and that is now explicit.** The one call site was
  `LearningEngineService.getReadiness`, which called `findPrerequisites` and threw
  the result away. Removed on 2026-07-28 rather than wired up, together with the
  injection and `LearningModule`'s `KnowledgeGraphModule` import, because an
  unused module edge reads as a real dependency in a modular monolith.

  **Why not simply point readiness at the graph** — it was the plan, and it is
  wrong today. Reading prerequisites from the graph makes the answer depend on
  the graph being complete, and a *missing* node yields zero prerequisites, which
  scores 1.0 and reports `ready` for a lesson whose prerequisites are unmet. An
  absent-data failure that reads as success is exactly what the age gate refuses
  to do. And the graph holds no lesson-level dependency that
  `prerequisiteLessonIds` does not, because it is derived from that field. The
  graph earns this reader when it carries concept-level prerequisites — not
  before.

  The N+1 in the same method was fixed at the same time: one `$in` query for
  every prerequisite card instead of a sequential `findOne` per item inside a
  nested loop (two 30-item prerequisites meant 60 round trips on a screen-load
  call). Behaviour is unchanged, verified by running both algorithms against the
  same seeded database and 499 cards across all 89 lessons that have
  prerequisites — 80 of them with a partial mastery mix — and comparing every
  field: identical throughout.



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

### 37. ADR-006 broke `npm run seed`, and nothing noticed for three commits (2026-07-28)

Moving analytics onto a queue gave `AnalyticsService` a `JobsService` dependency.
`SeedRootModule` is a cut-down graph — Mongo and the content modules, no Redis —
and it reaches `AnalyticsModule` transitively (`SeedModule -> ContentModule ->
forwardRef(LearningModule) -> AnalyticsModule`), so the seed died at boot with
`Nest can't resolve dependencies of the AnalyticsService`.

**This is OPEN-ITEMS #20 happening a second time**, same shape: a module in the
seed's graph gains a dependency only `AppModule` registers. The first was
`JwtService`.

What is uncomfortable is what did *not* catch it. Typecheck, `nest build`, 2943
unit tests, an application-context boot and a live end-to-end job round trip all
passed on the commit that broke it — because the seed has its own module graph and
nothing exercised it. It was found by running the seed to measure something else
entirely.

Fixed with a `@Global()` stub module providing `JobsService` in `seed.ts`
(root-module providers are not visible to imported modules — the first attempt
failed identically). CI now boots `AppModule` and runs the seed twice against
real Mongo and Redis services, which covers both this and #20's class.

**The underlying problem is not fixed:** `SeedRootModule` still duplicates
`AppModule`'s wiring by hand, and will drift again. The alternatives are worse in
different ways — importing `AppModule` would pull Redis and the HTTP layer into a
content script — so the guard is the CI step rather than the design.

### 10. RESOLVED (2026-07-28) — `npm run seed` is destructive-safe but not idempotency-tested in CI

CI runs the seed **twice** and fails the build unless both runs print an identical
summary. Verified locally on a fresh database: two runs, byte-identical counts
(208 kana, 802 words, 12 grammar points, 104 kanji, 1148 nodes, 228 edges, 90
lessons). The original note follows.



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

### 16. RESOLVED (T1.4, 2026-07-26) — lesson completion is gated on both counts

`POST /lessons/:id/complete` now returns **409** unless every id in the lesson's
`prerequisiteLessonIds` is in the caller's `completedLessonIds` **and** the caller
has answered at least one exercise for that lesson in any attempt. The missing
piece both fixes wanted — a record of exercise attempts — is the
`exerciseAttempts` collection, owned by `learning` and written by `ExerciseService`
through `ExerciseAttemptsService`.

*(This entry sat unresolved until 2026-07-26 even though T1.4 closed it. Noting
that, because a stale "known bug" is worse than an unrecorded one: the next reader
budgets time for work already done.)*

The original report follows.

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

### 31. Reports are filed but nobody reads them (slice 5, 2026-07-26)

The social module ships blocking and reporting alongside DMs, deliberately —
a messaging feature without them is the thing you cannot ship and fix later.
But **reports are write-only**: `status` starts `open` and nothing in the
codebase moves it. There is no moderation queue, no notification, and no
review UI. The rows are readable with `mongosh` and that is the whole of it.

This is a stated trade, not an oversight. A review UI is a bigger piece than
the slice it would have sat in, and a half-built one that silently drops
reports would be worse than none. A report button that files a row a human
can read beats one that goes nowhere.

**Cost of getting it wrong:** grows directly with the number of strangers who
can reach each other. At 32 accounts, mostly the operator's own, a solo
operator reading `db.reports.find({status:'open'})` is defensible. It stops
being defensible the moment registration brings in people who do not know
each other, because a report nobody reads is a promise the app is not
keeping — and the UI does promise it.

**Cheapest honest fix:** a `GET /social/reports` behind an admin check, or
even just an email on report creation, so the operator finds out without
remembering to look.

**Related and unbuilt:** there is no rate limit on friend requests (a person
can be requested by many accounts), and no way to see *who* blocked you
(deliberate — see the note on the opaque error message).

### 32. RESOLVED — `DELETE /me` is now overdue, not merely late (slice 5, 2026-07-26)

**Built since this was written** (see #5). The hard question it raised — what
happens to messages the deleted account wrote — was answered by keeping `reports`
(evidence for moderation) and deleting `directMessages`. That means the *other*
participant's copy of a conversation goes too, which is the opposite of the
tombstoning this note expected; it is defensible as the privacy-favouring reading
of erasure, but it was decided by implementation rather than in writing, and it is
worth confirming that is what you want. The original note follows.

Item 5 has said since Phase 0 that erasure gets harder every milestone. Slice
5 made it materially harder **and** materially more necessary in one commit:
there is now a social graph (`friendships`), user-written content about other
people (`directMessages`, `reports`), and `blocks` — and a cascade has to
decide what happens to each.

The hard question is the messages. Deleting an account cannot simply delete
its messages, because the *other* participant's conversation is their record
too, and a report's `messageText` snapshot exists precisely so evidence
survives the sender leaving. Tombstoning the sender ("deleted user") is the
usual answer and needs deciding rather than defaulting.

DPDP applies now, and this was already the item that "gets harder with every
milestone". It just got harder.

### 17. RESOLVED (ADR-006, 2026-07-28) — analytics writes are synchronous

`AnalyticsService.record()` now enqueues onto BullMQ and `AnalyticsProcessor`
does the Mongo insert on the worker. The predicted "swap, not a redesign" held
for the write itself; three things around it did not, and they are worth keeping.

**Two defects existed in the first cut and neither was visible to the test
suite.** The app did not boot at all — `JobsService` injected a queue token no
module registered — and both processors claimed one queue named `app`, which
misroutes: a BullMQ worker consumes *every* job on its queue regardless of job
name, so two workers each received the other's jobs and threw `Unknown job
name`. Measured at 12 of 12 jobs misrouted in a two-worker reproduction. Every
processor unit test passed throughout, because each constructs the class and
hands it a job of the kind it handles — the one case that cannot fail.
`jobs/queue-topology.spec.ts` now asserts the invariant by reflection, which is
the most CI can check without Redis.

**Read-your-writes is gone for two fields.** `daily.reviewsDone` and
`daily.lessonsDone` count the event log, so they now trail the action that
produced them by a worker hop — 1–19 ms measured on this box, cold and warm,
which is shorter than the client's next request. Documented at the endpoint in
`CLAUDE.md`. `xpToday` reads a user-document counter and is unaffected.

**Analytics now depends on Redis being up, where before it depended on Mongo.**
An outage loses events rather than failing requests, which is the trade §7 asked
for, but it is a different failure surface than the one the original note
assumed.

### 33. `JobsService.enqueue` swallows programming errors, not just outages (ADR-006, 2026-07-28)

`enqueue` never throws, on purpose: a queue in a bad state must not turn a
lesson completion into a 500. The cost is that it cannot tell an outage from a
bug, and it logs both at `warn`.

This was not hypothetical. The leaderboard's dedup id was `settle:<week>`, and
**BullMQ rejects a custom job id containing `:`** — so `add` threw, `enqueue`
logged, the request succeeded, and settlement silently never happened. Nothing
failed. It was found by watching a real enqueue, not by reading the code, and
it is exactly the class of bug this design makes quiet.

Mitigated for that one case by `settleJobId` plus a test. The general problem
stands: anything computed into a job's name, id or options is unvalidated until
it runs. The cheapest honest fix if this bites again is a dev-mode
`throwOnEnqueueFailure` flag so a bad enqueue is loud outside production.

### 38. `LearnerItemState` exists but nothing writes it yet (ADR-003, 2026-07-28)

The §5.2 learner model landed as a collection, the arithmetic, and an additive
backfill. **Deliberately with no writer and no reader**: §5.4 rule 2 is "additive
first, destructive later, never in the same commit", and the same logic applies at
the front — the field lands and is verified before code depends on it.

Backfilled against a copy of the real database: **386 cards → 386 states**, zero
evidence mismatches when every state is compared to its card, re-running is a
clean no-op (0 created, 386 skipped), and nothing existing was touched.

**Only 8 of 386 cards carry any review evidence at all.** The other 378 predate
`totalReviews`/`correctReviews` existing, so they backfill as `new` with confidence
0 — which is honest rather than a bug, but it means the learner model starts nearly
empty and the first adaptive session will have very little to go on. ADR-003's
"do this before the fields carry data worth preserving" turns out to have been
mostly right: there was barely any data to preserve.

**Three things are needed before the write path (the next slice):**

- **`ExerciseAttempt` records no item id and no exercise type.** It stores
  `{userId, lessonId, attempt, exerciseId, correct, responseTimeMs}`, and
  `exerciseId` is `{attempt}:{index}` — a position in a shuffle. So no historical
  answer can be attributed to an item, which is why `byExerciseType` and every
  response-time statistic backfill **empty**, and why lesson evidence starts
  accumulating only when the writer lands. The answer endpoint already has
  `itemId` to hand (it is in the question payload since 2026-07-27); the attempt
  row just never stored it.
- **No per-exercise-type baseline exists**, so the speed term in `confidence` is
  neutral for every row today. It needs `LearnerProfile` (§5.2, unbuilt) or a
  cheaper per-user aggregate.
- **The recency ring is reconstructed, not recorded.** A card knows how many
  reviews were correct, never in what order. The backfill orders failures first so
  the most recent outcomes read as correct — deliberately generous, because the
  alternative punishes every item ever failed once. Backfilled confidence is a
  starting estimate, not evidence.

**Mongoose does not await index creation**, and a migration process can exit
first: the first run against real data left `{userId, confidence}` unbuilt while
the unique index existed. `ensureIndexes()` now runs before any insert, which
matters because the unique index — not the lookup-before-insert — is what
guarantees one state per item.

### 36. Ten routes shipped undocumented, and nothing noticed (2026-07-28)

The root `CLAUDE.md` calls itself the single source of truth for the contract and
requires a response-shape change to update it *in the same commit*. It drifted
anyway. Found while dumping the real Express route table during ADR-007, not by
reading code:

- `POST /auth/logout`
- `DELETE /me` — with `OPEN-ITEMS` #5 and #32 still saying it did not exist
- `GET /learning/readiness/:lessonId`, `/learning/memory-model`,
  `/learning/analytics`
- `POST /content/report` — with #8 still saying the affordance was missing
- `GET /privacy`, `/terms`, `/legal/privacy`, `/legal/terms`

All ten are documented now. The interesting part is the failure mode: **the doc
rule only fires when someone remembers it**, and three of these came with an
`OPEN-ITEMS` entry that was left contradicting the code. A reader trusting either
file would have been wrong about what the API does — and for `DELETE /me` that is
a compliance-relevant wrongness, since the privacy policy names an endpoint the
notes claimed was unbuilt.

Documenting them also turned up two things that only surface when you write the
shape down: `unmasteredPrerequisites` returns display *labels* rather than ids, so
it cannot be used for lookup, and `readiness` mixes fractions (`readinessScore`,
`accuracyRateToday`) with percentages (`overallRetentionRate`,
`forgettingCurve[].retentionRate`) across neighbouring fields.

**Cheapest guard**, and worth doing before Phase 2 adds routes at speed: a spec
that scans the `@Controller`/`@Get`/`@Post`/… decorators in `src/` into a route
list and compares it against a checked-in inventory, failing when a route is added
without the inventory being updated. Static parsing rather than booting the app, so
it runs in CI without Mongo or Redis. Not built — it is a real piece of work, and
this pass fixed the symptom rather than the cause.

### 35. Both clients still call the unversioned paths (ADR-007, 2026-07-28)

The API now serves every route bare *and* under `/v1`, and the bare path is
pinned to v1 permanently — so `client/` and `web/` calling bare paths is safe
indefinitely, including after a `/v2` lands. Nothing is broken and nothing is
urgent.

What is still missing is **explicitness**: a client on a bare path never states
which contract it wants, so the bare path can never be repurposed or retired.
Moving both to `/v1` is one constant per project — `client/api/client.ts`,
`client/api/audio.ts` and `client/api/strokes.ts` each read
`EXPO_PUBLIC_API_URL` separately (worth collapsing to one export while touching
them), and `web/src/api.ts` has `BASE_URL` plus the exported `API_BASE`.

**Ordering matters and is the reason this is not done yet.** A client build that
asks for `/v1` against an API that has not been deployed yet 404s on every
request, and the Expo app is a separate artifact from the API deploy. The API
must be pushed and live *first*, then the clients rebuilt. Doing both in one
commit invites exactly the wrong sequence.

### 34. One process runs the API and every worker (ADR-006, 2026-07-28)

Workers are in-process, which §11 justifies at this size — one laptop, one
Redis, one deployable. It has consequences to know before load arrives:

- A slow or hot job competes with request handling for the same event loop.
  Nothing queued today is heavy; **AI lesson generation and speech scoring
  are**, and they are next (§6.14).
- Restarting to deploy stops the workers. In-flight jobs are recovered by
  BullMQ's stalled-job check, but a job that is not idempotent would be at risk;
  both current jobs are idempotent, and the next ones must be checked rather
  than assumed.
- The weekly settle schedule **skips a missed occurrence** rather than firing
  late, so a laptop asleep at 00:05 UTC Monday settles nothing. That is why the
  lazy enqueue on `GET /social/leaderboard` was kept as a second trigger, and
  why deleting it as "now redundant" would be wrong.

The queues are the seam when this stops being tolerable: a worker-only
entrypoint imports the owning modules and skips the HTTP layer.

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

## Phase 2 — Stage 0 follow-ups (2026-07-28)

Surfaced during Stage 0 verification. None block Stage 1; all worth a second
look before the next contract change.

### P2-1. `api/CLAUDE.md` is duplicated

The file has two H1 sections ("# Backend rules (`api/`)" at line 1 and
"# Project rules" at line 128) that each carry a near-identical copy of the
API rules. The first has the `StorageService` details ("abstract class … keys
are untrusted — `resolveKey` is the containment boundary"); the second has the
shorter version ("`put/get/delete`. Dev implementation writes to `./storage/`").
Both blocks were updated in commit `a2e36a8` to add a Phase 2 section, which
is why `grep -n '^## Phase 2' api/CLAUDE.md` returns three matches: two inside
each H1, one extra that I noticed mid-edit and removed.

Stage 1 housekeeping: collapse the two H1s into one. The drift between them
will only widen — they were identical in commit `a1a6d68`, then diverged when
the storage wording changed, and nothing flagged it because Claude Code reads
both halves equally and uses whichever comes first.

### P2-2. Heart/gem fields are inert on 33 existing accounts

Phase 2 §3.1 deleted the `hearts`, `heartsUpdatedAt`, and `gems` properties
from the schema but did **not** `$unset` the fields on existing user
documents. Per the user's instruction, no destructive migration was run; the
fields are still on disk on 33 accounts and the code no longer reads them.

This is fine today. It bites if a future field is added to `gamification` and
a partial `$set` somehow interacts with the dead fields, or if a hand-written
query reaches for `gamification.hearts` thinking it means something.

**Still not done, and deliberately not done in the `LearnerItemState`
migration** (2026-07-28), which is where this note previously said it should
ride along. §5.4 rule 2 is stricter than that plan: *additive first, destructive
later, **never in the same commit***. The backfill only inserts into a new
collection; adding an `$unset` across `users` to the same script would make one
command both harmless and irreversible, which is the combination the rule exists
to prevent.

The order is: this backfill ships → the write path ships → something reads the
model → verified → *then* a separate destructive migration drops
`gamification.hearts`, `heartsUpdatedAt`, `gems` **and** `SrsCard.totalReviews` /
`correctReviews`, which ADR-003 also wants moved off the card. Doing those two
together makes sense — both are "the old home of a signal that now lives in
`learnerItemStates`" — and neither should happen while the new home is still
unread. Only 3 of the 33 accounts still carry heart fields at all.

### P2-3. `relegationCount: 0` is a sentinel, not a feature

`Leaderboard.relegationCount` is typed as the literal `0` in both the server's
`league.service.ts` and the client's `social.ts`. The field stays on the wire
because removing it would break a stored client, and re-introducing
relegation later would not need a contract change. If relegation ever comes
back, the type widens; if it never does, the field is dead.

This is a deliberate choice, not an oversight — the same shape as `promotionCount`
on a too-small tier. Documented in the root CLAUDE.md on 2026-07-28. Mention
here so a future cleanup pass that deletes "always-zero fields" doesn't
delete the type-safety that makes this contract changeable.

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
| Basic vocabulary | **N5 complete — 802 words** across three units: 58 in 6 lessons (2026-07-22), 220 in 14 (T1.6, 2026-07-26), 512 in 32 (2026-07-27) |
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
