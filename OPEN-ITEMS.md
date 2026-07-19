# Open items — things worth your attention

Decisions I made on your behalf, trade-offs I took, and things deliberately
deferred. Nothing here is broken; it's the list of places where a reasonable
person could choose differently, plus the bills that come due later.

Ordered by when they'll bite you. Last updated after Milestone 6.

---

## Decide soon (before the learning loop lands)

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

### 0b. Nothing stops grading the same card repeatedly in one sitting

`POST /reviews/:cardId/grade` can be called back to back. FSRS handles this
sensibly for *scheduling* — with no elapsed time there's no retention evidence,
so intervals plateau rather than inflate (there's a test pinning that). But **XP
is awarded on every call**, so it's the same farming hole as #0, via a different
route.

Same fix shape: award review XP only when the card was actually due, or rate
limit the route. The scheduling side needs no defending — the library already
behaves correctly.

### 0. XP is re-awarded on every completion, so it can be farmed

`POST /lessons/:id/complete` awards a flat `XP_PER_LESSON_COMPLETION = 10` every
time it's called. Cards are idempotent; **XP is not.** A loop of eight curl
requests earned 80 XP in my concurrency test. There's no rate limit on this route
either — the throttler is only on `/auth/*`.

This is the literal reading of the milestone ("Award XP to the user"), and
re-awarding for practice is normal in habit-loop apps (§12 positioning). But
right now "practice" and "replay the same POST" are indistinguishable.

**Options, cheapest first:**
1. Award full XP only when `cardsCreated > 0`, and a smaller practice award
   otherwise. One line; makes XP track genuine new learning.
2. Award practice XP through the **review** loop (Milestone 5) instead, and make
   completion XP first-time-only. Cleaner product story, needs a completion
   record.
3. Rate limit the route. Mitigates but doesn't fix.

I'd take (2) when you build streaks and the daily goal (§14 step 6), since that's
where completion policy actually gets designed. Flagging now because it's a real
exploit sitting in `main`.

**Update after Milestone 6:** you chose to keep M6 to its stated scope, so this
is still open — but it got cheaper. Option (2) needed "a completion record", and
`lessonCompletions` now exists with a `timesCompleted` counter per (user,
lesson). First-time-only XP is now roughly: have `recordCompletion` return the
upserted doc, then award full XP when `timesCompleted === 1` and a smaller
practice award otherwise. `learning.service.spec.ts` has a test named "still
awards XP on a repeat completion" pinning today's behaviour — that's the one to
flip when you take this.

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

### 6. No backups

§11 calls this the classic self-host failure: your laptop is currently the only
copy. A nightly `mongodump` into a cloud-synced folder is a cron line and 20
minutes. Right now the only thing in Mongo is seed data you can regenerate, so
the real deadline is **the first real user account you'd be sad to lose.**

### 19. There is no frontend, and that is a deliberate pause

The blueprint's §3 diagram plans **Web (Next.js)** and **Mobile (Flutter)**, but
§14's build order never schedules either — steps 1–8 are all API work. So six
completed milestones correctly produced zero UI. The repo has no `.tsx/.html/.css`
at all.

Asked on 2026-07-19 whether to build one, Aakash said **"wait for now."** So this
is paused on purpose, not forgotten. Do not start a client without asking again.

The status page at `/` is **not** a frontend — no login, no lessons, no review.
It exists so the deployed URL doesn't 404 in a browser.

When it resumes, the three shapes considered were:

1. **Minimal vanilla HTML/JS page served by the existing NestJS app.** No new
   deps, no build step, no second deployable, same funnel mount. Smallest path
   to something a person can use; also the §11 answer for iOS, which is "web app
   as PWA via Funnel".
2. **Next.js per §3.** What the blueprint actually plans; a second deployable
   with its own build and deploy script. Needs `next`/`react` — and CLAUDE.md
   says dependencies need Aakash's approval first.
3. **Flutter mobile**, per §11's `flutter build apk` sideload line.

Whichever is chosen, the API is already complete for it: auth, lessons,
exercises, completion, reviews and `/me/progress` all work and are deployed.

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
character in lesson N+1. For this unit: 5×10 + 10×10 = **150 edges for 25
characters.** Fine at this scale, and the adjacency-list design is exactly what
§5 prescribes.

But full Hiragana + Katakana would be ~1000+ edges, and vocabulary would be far
worse. **The fix when it hurts:** a node per *row* (or per lesson) and link those
instead of individual characters — turns 150 edges into 5. I left it literal
because §5's "prerequisites of X" query wants character granularity, and
premature graph abstraction is harder to undo than to add.

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

`ExerciseService` filters lesson items to `kind === 'kana'` and throws 422 if none
remain. Lessons made of vocab, grammar or kanji items therefore can't generate a
quiz yet, even though `exerciseTypes` would allow it. Fine while the only seeded
unit is Hiragana; it's the first thing to extend when vocabulary lands.

Also note the reverse direction (show romaji, pick the kana) doesn't exist —
recognition and recall are different skills, and only one is being tested.

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
| 6. Streak + daily goal on `/me` | **next** |
| 7. One AI text chat scenario | not started |

`exerciseTypes: ['multipleChoice']` is seeded on all three lessons and
`ExerciseService` now honours it — a lesson that doesn't list `multipleChoice`
gets a 422 rather than a quiz.

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

---

## Environment note (not a code issue)

`npm test` timings swing wildly on this machine — the same suite measured 5.9s
and 22s on consecutive runs. Load average was ~11 on 4 cores, with roughly 20
Docker containers plus a browser competing. Jest spawns a worker per core and
thrashes. If it gets annoying, `npm test -- --maxWorkers=2` is usually *faster*
under contention. Nothing in the codebase changed to cause it.
