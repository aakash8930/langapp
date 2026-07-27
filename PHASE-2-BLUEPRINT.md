# Phase 2 Blueprint — from a course to a learner

**How langapp becomes a learner-centric adaptive platform, and in what order.**
Companion to `PHASE-0-BLUEPRINT.md` (the spec that got us here) and `OPEN-ITEMS.md`
(the debt ledger). Written 2026-07-27, against a verified working tree.

---

## 0. How to read this document, and what it is not

`PHASE-0-BLUEPRINT.md` answered "how does the thing you build first actually work".
It was right, it was followed, and it is now finished — every one of its §14 steps is
done and the content line in §1 is complete. This document answers the next question:
**what does it take to stop shipping a Japanese course and start shipping a learning
platform**, and it exists because that is a different kind of change from anything the
project has done so far. Everything up to now was additive. A meaningful part of what
follows is not.

Three rules govern this document.

**It is grounded, not aspirational.** Every claim about the current state was verified
against the working tree on 2026-07-27 — files read, tests run, git interrogated. Where
I say something exists, I have looked at it. Where I say something is missing, I have
looked for it. Numbers are counted, not remembered.

**It sequences honestly.** The vision as stated is roughly fifteen major initiatives.
Delivered by one person at the pace this repo has actually sustained, that is a multi-year
programme, not a phase. Pretending otherwise would produce a plan that fails at the third
milestone. So §8 sequences the work into stages with entry and exit criteria, and says
plainly which stages are years out.

**It surfaces conflicts rather than smoothing them.** The stated product philosophy
contradicts shipped, working, tested code in at least three places. The most important
section of this document is §3, which names those contradictions and asks for decisions.
No code should be written against this plan until §3 is answered, because the answers
change what gets built and what gets deleted.

**This document does not contain code, and no code has been written for it.** That was
the instruction, and it is also the right order: the schema decisions in §5 are expensive
to reverse once data exists in them.

---

## 1. Where the project actually is, 2026-07-27

### 1.1 The shape on disk

```
langapp/
  api/       NestJS + MongoDB + Redis     19,326 lines of TypeScript in src/
  client/    React Native + Expo          13 screens, 30 components, 13 api modules
  web/       React + Vite                 11 components — "the shop window"
  tools/     Python — TTS (Kokoro), KanjiVG stroke fetch, icon generation
  scripts/   nightly mongodump + a restore verifier
  deploy/    systemd unit templates
  .github/   CI — untracked, see §1.3
```

Not npm workspaces, deliberately: Expo's Metro bundler resolves badly under hoisting, so
all three apps keep their own `package.json` and `node_modules`.

### 1.2 What is committed and live

**Verified by running it, 2026-07-27:** `npm run typecheck` clean, `npm test` green —
**33 suites, 2932 tests, 6.2s**.

| Subsystem | State |
|---|---|
| Auth | argon2id, rotating single-use refresh tokens, throttled, anti-enumeration login |
| User | `/me`, settings, XP, level, streak, daily goal, **hearts, gems, leagues** |
| Content | 11 units, 90 lessons — 208 kana, 802 words, 12 grammar points, 104 kanji |
| Exercises | `multipleChoice` + `wordReading`, deterministic per `(lesson, user, attempt)` |
| Learning | `ts-fsrs` SRS, lesson completion gate, XP awards, event log |
| Knowledge graph | adjacency list, two collections, ~1614 edges |
| Chat | Gemini free tier, one scenario, one call per turn, corrections feed SRS |
| Social | friends, DMs, blocks, reports, weekly UTC leaderboard with promotion/relegation |
| Media | per-word and per-kana audio (Kokoro TTS), KanjiVG stroke order |
| Ops | Tailscale Funnel, systemd deploy timer, nightly verified backups |

The curriculum is one chain: hiragana → katakana → first words → hiragana marks →
katakana marks → marks-extra ×2 → everyday words → grammar → kanji → the rest of N5.
By `vocab-everyday` a learner knows **151 distinct characters**. JLPT N5's vocabulary is
complete at 802 words; its kanji at 104.

**This is a genuinely good foundation.** The module boundaries are honest, the
reasoning is documented at the point of decision rather than in a wiki, and the test
suite is large enough to refactor behind. Very little of what follows is a rewrite.

### 1.3 What is in flight and uncommitted — read this before anything else

`git status` shows **29 modified files, 14 untracked paths, and 2 deletions**. This is
not a scratch pile; it is a coherent body of work that typechecks and passes every test.
It has to be landed before Phase 2 begins, because Phase 2 builds directly on it.

**New, untracked:**

- `api/src/learning/learning-engine.service.ts` + controller — `GET /learning/readiness/:lessonId`,
  `GET /learning/memory-model`, `GET /learning/analytics`. Readiness scoring, a mastery
  breakdown, and a 30-day forgetting curve from `R = e^(-t/S)`. **This is the first real
  piece of the adaptive engine.**
- `api/src/content/exercise/plugins/` — an `ExercisePlugin` strategy interface and a
  registry with six plugins: `multipleChoice`, `wordReading`, `listening`,
  `sentenceBuilding`, `fillInTheBlank`, `flashcard`.
- `api/src/user/account-deletion.*` — a real cross-module cascade. **This closes
  OPEN-ITEMS #5 and #32**, the DPDP/GDPR erasure item that has been overdue since Phase 0.
- `api/src/content/content-report.controller.ts` + schema — `POST /content/report`.
  **This closes OPEN-ITEMS #8**, the "report a mistake" affordance that §13 item 2 calls
  the cheapest guard against the existential risk of teaching wrong Japanese.
- `api/src/legal/` — `GET /privacy`, `GET /terms`. **This closes the second half of
  OPEN-ITEMS #7.**
- `.github/workflows/ci.yml` — typecheck, build and test for `api/` and `web/` on push.
  The first CI this repo has had.

**Modified, notably:**

- `SrsCard` gains `totalReviews` and `correctReviews`, plus a `computeMastery()` helper
  mapping FSRS stability onto `new | learning | familiar | mastered`.
- `ExerciseAttempt` gains `responseTimeMs`.
- `ContentKind` gains `'lesson'`, so lessons can be nodes in the knowledge graph.
- `Question` gains a `GenericExerciseQuestion` arm for the four new plugin types.
- `ExerciseService.generate` now defaults `attempt` from stored state rather than trusting
  the query param — **this closes OPEN-ITEMS #4a**.
- Wrong exercise answers now reach `LearningService`, so a missed question pulls its SRS
  card forward. That is the connection OPEN-ITEMS #23 called "the obvious next one".

**Deleted from the working tree — almost certainly by accident:**

```
 D OPEN-ITEMS.md          (833 lines)
 D PHASE-0-BLUEPRINT.md   (477 lines)
```

Both are still in `HEAD` and recoverable with `git checkout -- PHASE-0-BLUEPRINT.md
OPEN-ITEMS.md`. Nothing in the change set justifies removing them, six other files still
reference them by name (`README.md`, all three `CLAUDE.md` files), and `OPEN-ITEMS.md` is
the only record of about thirty deliberate trade-offs. **Restore them before committing
anything.** This document assumes they exist.

### 1.4 What the in-flight work means for the plan

Three of the four compliance items that have been outstanding since Phase 0 are closed in
this pile: erasure, mistake reporting, and the legal pages. That matters more than it
looks, because §6.11 (AI-generated content) is gated on exactly those. The pile also
establishes the two structural patterns Phase 2 extends — a plugin registry for exercises,
and a learner-model service that reads across cards and attempts. **Phase 2 is mostly a
continuation of work already started, not a new direction.**

---

## 2. The thesis

Today the unit of the product is a lesson. A learner walks a fixed chain of 90 lessons in
a fixed order; the SRS remembers what they have seen, but nothing in the system holds an
opinion about *them*. Two learners with identical completion records get identical
lessons, identical quizzes, identical explanations, and identical review queues, even when
one of them has failed へ eleven times and the other has never missed it.

Phase 2 makes the learner the unit. Concretely, that is four shifts:

**1. The system holds a model of the learner, and that model drives selection.** Not a
counter of what has been completed, but per-item evidence: attempts, mistakes, latency,
confidence, mastery, and predicted retention. Every screen that today asks "what is next
in the chain" asks instead "what does this person need next".

**2. Content becomes data, not code.** Today "Japanese" is `lang: 'ja'` hardcoded in eight
schemas and a `seed/japanese/` directory of TypeScript. A second language is a code
change. After Phase 2 it is a content import.

**3. The tutor teaches rather than converses.** Today the AI is one chat scenario with a
static word list. After Phase 2 it explains the specific mistake this learner just made,
using the vocabulary this learner actually knows, in a form calibrated to their level.

**4. The measurements describe learning, not activity.** XP and streaks measure showing
up. Retention, vocabulary size, grammar mastery and estimated proficiency measure whether
it worked.

Everything in §6 serves one of those four. Anything that serves none of them is scope, and
should be argued for on its own terms rather than smuggled in under "adaptive".

---

## 3. Three conflicts to resolve before any code

The vision includes an explicit product philosophy: *no hearts, no energy systems, no
forced waiting, no premium-only learning restrictions, no unnecessary friction.* Shipped
code contradicts this. These are not bugs and not oversights — each was built
deliberately, with its reasoning written down. They need a decision, not a patch.

### 3.1 Hearts and gems are fully implemented, and are exactly the mechanic the vision rejects

`api/src/user/gamification/hearts.ts`, `MAX_HEARTS = 5`, `HEARTS_REGEN_MINUTES` (default
30), `GEM_COST_HEART_REFILL = 50`, `POST /me/hearts/refill`, a `HeartsBar` component in
the app, and heart-spending wired into every wrong exercise answer. Regeneration is
computed on read, the arithmetic is unit-tested for clock skew and backwards time, and
the schema comment is unusually candid about what it is:

> Hearts — the Duolingo loss-aversion mechanic. […] In Duolingo, running out of hearts
> is a sales funnel — you buy a refill. Phase 0 excludes in-app purchases, so here it is
> **pure friction with no escape hatch except waiting or spending gems.**

"Pure friction" and "waiting" are the two things the philosophy names. This is a direct
contradiction between the stated product principles and roughly 300 lines of working,
tested code plus a client component.

**The options:**

- **(a) Remove hearts and gems entirely.** Honours the philosophy without qualification.
  Costs: delete `hearts.ts`, the refill route, the schema fields, the client bar, and
  about 15 tests; decide what happens to the gem balances 30-odd accounts already hold.
  A migration that drops fields is irreversible without a backup restore — do it
  immediately after a verified backup.
- **(b) Keep the mechanic, default it off.** `HEARTS_REGEN_MINUTES=0` already
  short-circuits `heartsNow` to full, so hearts can be disabled by configuration today,
  with no code change. Cheapest, and preserves the option. Costs: the philosophy becomes
  "no hearts by default", which is a weaker promise, and dead-but-live code accumulates
  maintenance and confusion.
- **(c) Repurpose the mechanic as a non-punitive signal.** Keep the tracking of wrong
  answers (which the adaptive engine wants anyway — see §6.1) and drop the depletion,
  the wait and the currency. Hearts become "this lesson found four weak spots", which is
  information rather than a wall.

**My recommendation: (c), implemented as (a) plus §6.1.** The data hearts collect — where
and how often a learner errs — is precisely what the learner model needs, so the useful
half survives the deletion by being rebuilt somewhere it belongs. Option (b) leaves a
mechanic that contradicts the product's stated values one env var away from being live,
and a promise that depends on a config value is not a promise.

### 3.2 Leagues, promotion and relegation are competitive pressure by design

`LeagueService` settles a weekly UTC ranking, promotes and relegates across tiers, and the
API reports `promotionCount` and `relegationCount` so a client can draw cut-off lines.
The reasoning for the UTC week is sound and documented. But relegation is loss aversion —
the same psychological lever as hearts, applied to social standing rather than lives, and
"you will drop a tier unless you study before Sunday" is manufactured urgency.

This is a softer conflict than hearts, because the philosophy does not name leaderboards.
It rejects *artificial* engagement mechanics, and a leaderboard among consenting friends
is not obviously artificial. But relegation specifically manufactures a deadline, which is
the same shape of thing.

**The options:** keep as is; keep the leaderboard and drop relegation (promotion only —
you can rise, you cannot be punished); or make the whole thing opt-in and default it off.

**My recommendation: promotion-only, plus opt-in.** It keeps the social motivation for
people who want it and removes the deadline for everyone else. `leagues.ts` already
separates the two counts, so this is a small change.

### 3.3 "No premium-only learning restrictions" contradicts blueprint §12

`PHASE-0-BLUEPRINT.md` §12 defines Premium as "unlimited/higher voice conversation,
offline, advanced analytics". The vision says no premium-only learning restrictions and
puts offline-first and rich analytics at the centre of the product.

These cannot both hold. Offline access and analytics are either core or they are the
paywall; the same feature cannot be both. And §8's cost model is not decoration — voice
AI genuinely can cost more per active user than a language-app subscription earns, which
is why §12 put the paywall where it did.

**The honest reconciliation, and my recommendation:** the paywall sits on **marginal
per-user cost**, never on learning. Concretely — everything that is content, scheduling,
analytics, offline access and text tutoring is free forever, because its marginal cost is
near zero. Voice conversation, unlimited AI lesson generation and anything else that bills
per request is metered, because each use costs real money and an unmetered free tier of it
is a promise that ends in the product being switched off. That reading satisfies "no
premium-only learning restrictions" — nothing that teaches is gated — while staying
solvent. It needs writing into §12 as an amendment, because as written §12 says otherwise.

### 3.4 A smaller fourth: `client/CLAUDE.md` and `api/CLAUDE.md` forbid most of this

Both say, in a section headed *What NOT to build in Phase 0*: no voice/STT/TTS, no second
language, no teacher portal, no marketplace, no i18n framework, no admin panel, no
offline caching — "if a task seems to need one of these, stop and ask."

Phase 2 requires nearly all of them. Those files need a Phase 2 section that supersedes
the Phase 0 boundary, or every future session will correctly refuse the work. This is
bookkeeping rather than a decision, but it has to happen in the first commit or it will
cause repeated friction.

---

## 4. Architecture decisions

### ADR-002 — the modular monolith holds

**Status:** affirmed · **Date:** 2026-07-27

Nothing in Phase 2 justifies splitting the deployment. The forces ADR-001 named as
triggers — divergent scaling profiles, a separate team, a language-specific runtime —
still do not exist. One developer, one laptop, ~30 accounts.

The one candidate worth watching is speech processing (§6.8), which has a genuinely
different CPU profile from the CRUD app and would be the first extraction. Not yet.

**What does change:** the module count grows, and the one rule that makes extraction
cheap — *a module never touches another module's collections* — comes under more pressure
as cross-cutting reads multiply. The in-flight `AccountDeletionService` shows the right
pattern for that: when orchestration needs several modules, put it in a service above
them rather than letting one reach sideways.

### ADR-003 — the learner model is a module and a collection, not fields on SrsCard

**Status:** proposed · **Decides:** §6.1

`SrsCard` is FSRS's state. The in-flight work adds `totalReviews` and `correctReviews` to
it, which is a reasonable first step and the wrong long-term home: the vision wants
confidence, response-time distribution, mistake history, per-exercise-type performance and
context tags, and none of that is scheduling state. Loading it on every review query
would bloat the hottest read in the system — `{userId, due}`, which currently serves
entirely from a compound index with no in-memory sort.

**Decision:** a separate `learnerItemStates` collection, one document per
`(user, item)`, owned by `learning`, holding the pedagogical model. `SrsCard` keeps
exactly FSRS's state and nothing else. They share a key and are read together only when
something actually needs both.

**Consequence:** two documents per item per learner instead of one. At 800 items × 30
learners that is 24,000 documents, which is nothing. At 100,000 learners it is 80M and
wants revisiting — that is the trigger, not a date.

**Migration:** `totalReviews` / `correctReviews` move off `SrsCard` before they carry
data worth preserving. Doing this now costs a backfill of zeros; doing it in six months
costs a real migration.

### ADR-004 — generalise content by adding a layer, not by rewriting the schemas

**Status:** proposed · **Decides:** §6.5

The obvious move for multi-language is a generic `ContentItem` with a `payload: any`.
It is also the wrong one: it discards every type guarantee the codebase has, and the
Japanese-specific specs (`romaji.spec.ts` transliterating 802 words to catch typos,
`vocab-everyday.spec.ts` refusing untaught characters) are among the most valuable tests
here precisely because they know what a Japanese vocabulary item is.

**Decision:** keep typed per-kind schemas. Add `Language` and `Course` as real documents,
make `lang` a reference rather than a literal `'ja'`, and let each language pack register
its own item kinds through a `LanguagePack` interface — the same shape as the exercise
plugin registry, which is the pattern the codebase has already chosen twice.

**Consequence:** adding a language is a pack plus its content, not a schema migration.
Adding a *kind* of item that Japanese does not have (Spanish gendered nouns, tonal marks)
is a new schema, which is correct — it is genuinely new information.

### ADR-005 — the dependency graph moves from characters to concepts

**Status:** proposed · **Decides:** §6.2

`SeedService.linkPrerequisiteNodes` links every character in lesson N to every character
in lesson N+1: 1614 edges for 208 kana, growing quadratically. OPEN-ITEMS #9 already
records that the count is not the strongest objection — the semantics are wrong. The
last yōon lesson alone writes 144 edges asserting **ぴょ requires りょ**, which is true in
no sense; they are siblings in a table, taught together for convenience.

A grammar dependency graph cannot be built on top of a graph that records packaging as
dependency. Fix it first: a node per concept (a row, a lesson, a grammar point) with
edges between concepts. 1614 edges become roughly 42, and the graph stops asserting
things that are not so.

### ADR-006 — background jobs land before the features that need them, not with them

**Status:** proposed · **Decides:** §6.14

OPEN-ITEMS #17 has wanted analytics off the request path since Phase 0, and §7 of the
blueprint specifies it. It has been survivable because one synchronous insert is cheap.
Phase 2 adds work that is not cheap: AI lesson generation, speech scoring, proficiency
recomputation, notification scheduling, TTS pre-generation. Each of those on the request
path is a timeout.

BullMQ over the existing Redis — already a dependency, already in the blueprint's §3
diagram as the queue. **This is the one infrastructural prerequisite that blocks several
features at once, and it should land early rather than being retrofitted per feature.**
It needs a dependency approval (§12 Q6).

### ADR-007 — version the API before the second client shape exists

**Status:** proposed · **Decides:** §6.14

There are three clients (Expo app, web, and any sideloaded APK that a tester never
updates), and the contract has already had one breaking change: `dateOfBirth` became
required at registration on 2026-07-26, and an older build now gets a 400 on signup.
That happened with no versioning to absorb it.

Phase 2 changes response shapes repeatedly. `/v1` prefixing with the current shapes
frozen, and new work on `/v2`, costs a routing change now and saves a class of outage
that is very hard to fix remotely — an installed APK cannot be recalled. Note that
Tailscale strips the `/langapp` prefix before proxying, so the app cannot know its own
public base path; the version segment must sit *after* whatever the funnel mounts.

---

## 5. Target data model, and how to get there

### 5.1 The content hierarchy

Target: **Language → Course → Unit → Lesson → Exercise → Question**, where the first two
are new documents and the rest already exist in some form.

```
Language      { code, name, nativeName, script[], direction, defaultCourseId,
                packId }                                   // NEW
Course        { languageId, slug, title, description,
                targetProficiency, goalTags[], unitIds[],
                authorId?, visibility, version, status }    // NEW
Unit          { courseId, slug, title, order, lessonIds[] } // NEW as a document
                                                            // (today: a string on Lesson)
Lesson        { unitId, order, title, itemRefs[],
                exerciseTypes[], prerequisiteLessonIds[] }  // EXISTS — gains unitId
Exercise      generated, not stored                          // EXISTS — see §6.4
Question      generated, not stored                          // EXISTS
```

Two properties of the current design are worth preserving deliberately, because they are
better than what most systems in this space do:

**Exercises are not stored.** Generation is a pure function of `(lessonId, userId,
attempt)` plus content, through a seeded PRNG. Refreshing returns the identical set;
answering re-derives it server-side and grades against it, so no answer key ever reaches
the client and there is no store to expire. Adaptive selection (§6.1) must preserve this —
adaptivity changes *which* items are chosen, and the seed must then incorporate the
selection so the set stays reproducible.

**`lemma` and `reading` are separate fields even where they are identical.** All 802 words
currently have `lemma === reading`, which looks like a placeholder and is not: ねこ is a
correct way to write 猫, and when kanji spellings arrive `lemma` gains them while `reading`
is already right. This is exactly the shape a second language needs.

**Migration.** `Unit` exists today as a bare string on `Lesson` (`unit: 'hiragana-basics'`),
which makes it a clean promotion: create a `Unit` document per distinct string, backfill
`unitId`, keep the string as a denormalised slug for one release, then drop it. `Course`
and `Language` are pure additions — one `Language` (`ja`) and one `Course` ("JLPT N5
Complete") covering all 11 existing units. **No content is rewritten**, which matters
because every seed write is an upsert on a natural key and `_id` stability is what lets
existing SRS cards keep pointing at their items.

### 5.2 The learner model

Per ADR-003:

```
LearnerItemState  {
  userId, itemRef: { kind, id },
  // evidence
  exposures, correct, incorrect,
  responseTimeMs: { count, mean, m2 },   // Welford — streaming variance, no array
  lastNOutcomes: boolean[],              // ring buffer, N=10, for recency
  byExerciseType: { [type]: { seen, correct } },
  // derived, recomputed on write
  confidence: number,                    // 0..1
  masteryLevel: 'new'|'learning'|'familiar'|'mastered',
  // provenance
  firstSeenAt, lastSeenAt, sourceContexts: string[]   // lesson | review | chat | reading
}

LearnerProfile  {                        // one per user per language
  userId, languageId,
  estimatedLevel, vocabularySize, grammarMastery: { [pointId]: number },
  strengths: string[], weaknesses: string[],
  goals: { type: 'jlpt'|'anime'|'travel'|'business'|'conversation', target?: string }[],
  recomputedAt
}
```

Three design notes.

**Response time is stored as running statistics, not as a list.** Welford's algorithm
gives mean and variance in constant space. An array of every response time for every item
grows without bound and is never read in full.

**Confidence is derived and stored, not computed on read.** It is read on every session
composition and written only on answer, so the asymmetry favours storing it. It must be
recomputable from the evidence fields, and there should be a test that recomputes it for
a sample and compares — a derived field that can drift from its inputs is a bug waiting.

**`byExerciseType` is what makes "weakness" specific.** "Weak on へ" is much less useful
than "recognises へ in multiple choice, cannot produce it when typing" — that is the
difference between recognition and recall, which OPEN-ITEMS #10b already flagged as a real
gap. It also directly answers which exercise type to serve next.

### 5.3 The concept graph

Per ADR-005. `KnowledgeNode` already gains `'lesson'` as a kind in the in-flight work,
which is the first step. The target adds `'concept'` — a node that is not a content
document but an idea ("the が/は distinction", "the あ row", "な-adjectives"), with edges
typed `prerequisite | contains | related | contrasts-with`.

`contrasts-with` is new and pedagogically load-bearing: シ/ツ, は as particle vs は as
syllable, が vs は. These are the pairs learners actually confuse, and the exercise
generator already benefits from them accidentally — distractors drawn from the unit pool
naturally put ツ beside シ, which is the discrimination worth drilling. Making it explicit
lets the generator do it on purpose.

### 5.4 Migration sequencing

Every one of these runs against a live database with real accounts. The rules:

1. **A verified backup immediately before each migration.** `scripts/backup.sh` restores
   and counts every archive before accepting it, so this is one command. Note the caveat
   in OPEN-ITEMS #6: backups share a disk with the database, so this protects against a
   bad migration, not against losing the disk.
2. **Additive first, destructive later, never in the same commit.** Add the field, backfill
   it, ship the code that reads it, verify, *then* drop the old one in a separate change.
3. **`npm run seed` in dev seeds production.** There is one database. A bad seed is live
   the moment it runs. Migrations that touch content must be verified against a scratch
   database first (`scripts/verify-restore.sh` already builds one).
4. **Preserve `_id`s.** SRS cards reference content documents by id. Any migration that
   recreates content rather than updating it silently orphans every learner's progress.
   OPEN-ITEMS #10 notes nothing enforces this yet — add the "seed twice, ids unchanged"
   test before the first content migration, not after.

---

## 6. The subsystems

Each section: what exists, what is missing, the design, and what it costs. Ordered by
dependency, not by importance.

---

### 6.1 The adaptive learning engine

**Exists (in flight):** `LearningEngineService` with three endpoints — readiness scoring
per lesson, a memory model with a 30-day forgetting curve from `R = e^(-t/S)`, and review
analytics. `computeMastery()` maps FSRS stability onto four levels. `SrsCard` counts
reviews and correct reviews; `ExerciseAttempt` records response time.

**Missing:** everything that makes it *adaptive*. The engine currently reports; it does
not decide. No screen changes because of it. Response time is recorded and never read
back into selection. Session composition is still "the next lesson in the chain" and
"the 20 oldest due cards".

**Three defects in the in-flight code to fix while extending it:**

- `getReadiness` issues one `findOne` **per prerequisite item, inside a nested loop over
  prerequisite lessons**. For a late lesson with several prerequisites of 15–20 items
  each, that is 40–60 sequential round trips for one page load. It wants a single `$in`
  query over the item ids.
- `getMemoryModel` loads every card for the user and then runs a 30-iteration loop over
  all of them — O(30N) in JS on the request path. At 800 cards that is 24,000 `Math.exp`
  calls per request. Cache it (it changes only on review) or compute the curve from
  aggregate stability buckets rather than per card.
- The mastery thresholds — `stability < 7` learning, `< 30` familiar, else mastered — are
  unexplained constants. They are plausible, and they are also the numbers that decide
  what "mastered" means to a learner. They need either a citation or a named constant with
  the reasoning attached, in the style the rest of this codebase uses.

**The design.**

*Selection.* A session is composed from a weighted pool rather than a queue:

```
due reviews          weight ∝ overdueness × (1 − confidence)
weak items           items with confidence < threshold, not yet due
new material         the next lesson, gated on readiness ≥ threshold
contrast drills      items whose `contrasts-with` partner was recently missed
goal-weighted items  items tagged for the learner's stated goal (§6.9)
```

Capped at a bounded session size, as §6 of the Phase 0 blueprint requires. The
composition must be deterministic given `(userId, sessionSeed)` so the reproducibility
property from §5.1 survives.

*Scheduling.* `ts-fsrs` continues to own every interval. This is not negotiable and it is
worth saying why: the temptation in an "adaptive engine" is to start adjusting intervals
from confidence, and that would feed the scheduler observations that never happened and
degrade every interval it computes afterwards. The precedent is already set and
correct — `scheduleMissedWords` moves `due` and writes nothing else, with a test pinning
that the update document has exactly one key. **The adaptive engine may choose what to
show and when to surface it early; it may never write `stability`, `difficulty`, `state`,
`reps` or `lapses` outside a real graded review.**

*Confidence.* A function of recent outcome ratio, response time relative to the learner's
own baseline for that exercise type, and exposure count — deliberately not a function of
FSRS stability, which already exists and measures something different (predicted retention
vs. felt certainty). A fast correct answer and a slow correct answer are different
observations, and response time is the only signal in the system that can tell them apart.

**Cost:** large. This is the core of Phase 2 and the thing every other section leans on.
Estimate several weeks of evenings, most of it in getting selection to feel right rather
than in writing it.

**Risk:** adaptive selection that feels arbitrary is worse than a fixed chain, because a
learner cannot tell whether it is broken. Mitigation: every adaptive decision must be
explainable in one sentence on screen — "reviewing へ because you have missed it 3 of the
last 4 times" — and there should be a debug endpoint that dumps the reasoning for a
composed session.

---

### 6.2 The concept dependency graph

**Exists:** two collections, adjacency list, ~1614 edges, character-to-character, with
`'lesson'` newly added as a node kind.

**Missing:** grammar has no edges at all. There are no concept nodes, no `contrasts-with`,
and the existing edges assert relationships that are not true (ADR-005).

**Design.** Rebuild edge generation around concepts. A grammar dependency graph is the
actual goal here — "は before が-as-contrast", "て-form before て-います", "plain form
before casual speech" — and it is authored, not derived. It belongs in the seed as data,
per grammar point, the same way `prerequisiteLessonIds` already is.

Ordering guarantees then come from a topological sort over the concept graph rather than
from a hand-maintained chain, which is what lets a second course reorder units without
breaking pedagogy.

**Cost:** medium. The edge rebuild is a seed change plus a migration. The grammar edges
are content authoring — a day's careful work for the 12 existing points, and an ongoing
authoring obligation for every new one.

**Risk:** low technically, high pedagogically — a wrong prerequisite edge blocks a learner
from content they are ready for, and that is invisible unless someone reports it. The
mistake-reporting route landing in the in-flight work is the mitigation.

---

### 6.3 The AI tutor

**Exists:** one scenario (`first-meeting`), one Gemini call per turn returning reply and
corrections together under a `responseSchema`, corrections persisted onto the learner's
message and matched against taught vocabulary to pull SRS cards forward. History capped at
12 turns, messages at 500 chars, provider 503s retried with bounded backoff. Verified
against a real model on 2026-07-22.

The infrastructure is genuinely good. `AiOrchestratorService` isolates prompt assembly
from the provider so a Stage B swap touches one file.

**Missing:** it converses; it does not teach. Target words are static in `scenarios.ts`
because when it was written the graph held only kana — OPEN-ITEMS #23. There is no
"explain my mistake", no "why is it は here", no example generation, no
language-comparison, no difficulty-calibrated explanation. There is no chat history
endpoint, so the transcript lives in React Query's cache and dies with the screen.

**Design — the tutor as a set of prompt strategies.** Blueprint §4 is explicit that agents
are prompt variants inside `AiOrchestrator`, not services, and that holds. Each strategy
is a role, a system prompt, a retrieval spec and an output schema:

| Strategy | Trigger | Retrieves | Returns |
|---|---|---|---|
| `explain-mistake` | learner answers wrong | the item, its concept, the learner's history with it | why it is wrong, the rule, one example |
| `why-question` | learner asks "why…" | the concept and its contrasts | an explanation calibrated to their level |
| `generate-examples` | learner requests more | the item + known vocabulary | sentences using only words they know |
| `compare-languages` | learner's L1 differs | the concept + L1 | the contrast with their native language |
| `simplify` | learner says "I don't understand" | the previous explanation | the same thing, simpler |
| `converse` | chat screen | scenario + weak items | today's behaviour |

**The retrieval change is the one that matters most and is cheapest.** Replacing the
static word list with a real query — the learner's weak items, their known vocabulary,
the concept in question — is what turns a generic chatbot into a tutor, and the data now
exists to do it. §7 of the Phase 0 blueprint specified this from the start; it was
deferred only because the graph was empty. It is not empty any more.

**Constraint that must not be lost:** *generate examples using only words the learner has
been taught.* The seed already enforces this discipline for authored content —
`vocab.spec.ts` caught three words needing untaught marks on its first run — and an LLM
will cheerfully ignore it. The known-vocabulary list has to be *in* the prompt, and the
output has to be validated against it before display, not trusted.

**Cost:** medium per strategy, low for the retrieval fix. The retrieval fix alone is
probably the highest value-per-line change in this entire document.

**Risk:** hallucinated grammar taught confidently. §13 item 2 calls this the existential
risk of an AI-content language app. Mitigations: the report action (now in flight),
validation of generated examples against known vocabulary, and a human review gate before
any generated content is persisted as curriculum (§6.11).

**Cost control:** every strategy above is a provider call that today's product does not
make. §8's discipline applies — cheap model for classification and correction, stronger
model only for the actual tutoring sentence, aggressive caching of explanations (an
explanation of は is the same for everyone at a given level, so it should be generated
once and cached, not per learner).

---

### 6.4 Exercise plugins

**Exists (in flight):** an `ExercisePlugin` interface with `generateQuestion` and
`gradeAnswer`, a registry of six, and `GenericExerciseQuestion` in the public DTO union.

**Missing, and this is important:** four of the six are registered but **not reachable**.
The routing in `ExerciseService.answer` explicitly excludes `multipleChoice` and
`wordReading` from plugin dispatch and keeps them on the legacy path, so the two that
work go around the registry and the four that go through it have no lesson that lists
them in `exerciseTypes`. The registry is also injected as an optional constructor
parameter (`pluginRegistry?`), which means it can be silently absent and generation will
quietly fall back.

Complete the abstraction before extending it: all six through the registry, no optional
injection, no special cases. A plugin architecture with two exceptions hardcoded around
it is not a plugin architecture.

**Target set**, with what each needs:

| Plugin | Status | Needs |
|---|---|---|
| multipleChoice | works, legacy path | migration into the registry |
| wordReading (typing) | works, legacy path | migration into the registry |
| listening | plugin exists | wired to existing audio; distractor rules |
| sentenceBuilding | plugin exists | tokenised sentences — see §6.6 |
| fillInTheBlank | plugin exists | generalising beyond grammar's `＿` marker |
| flashcard | plugin exists | a self-grade path distinct from review grading |
| matching | not built | pairs from a lesson pool |
| kanjiWriting | not built | stroke capture + comparison (§6.7) |
| speaking | not built | STT (§6.8) |
| shadowing | not built | audio + timing comparison (§6.8) |
| pronunciation | not built | phoneme scoring (§6.8) |

**Carry forward two rules that already exist and are easy to lose.** First,
`toPublicQuestion` is an allowlist — an explicit field copy, not a delete — which is what
makes "no answer key reaches the client" a property of the contract rather than something
the code might quietly lose. Every plugin's output must go through it. Second, audio must
not be offered where it answers the question: `vocab` prompts ask for an English gloss, so
they can speak freely, but `wordReading` and `kana` prompts ask for romaji and the
recording *is* that romaji. The `listening` plugin inverts this — the audio is the
prompt — so it needs its own rule rather than inheriting either.

**Also fix OPEN-ITEMS #29 here.** Distractors come from the whole unit pool, which was
fine at 58 words across 6 lessons and is visibly wrong at 220 across 14: the live quiz for
チーズ offered "two", "an answer" and "library", so a learner eliminates three options on
category alone. Prefer same-lesson distractors with a unit fallback — the fallback is
required, not optional, because a 6-word marks lesson cannot supply three same-theme
distractors. Note this changes every existing deterministic `(lesson, user, attempt)`
triple, so it is a deliberate behaviour change and belongs in its own commit.

**Cost:** low-medium for the six that exist, high for the speech-dependent four.

---

### 6.5 Multi-language content

**Exists:** `lang: 'ja'` as a literal on six content schemas, `activeTrack: 'ja'` on the
user profile, and `seed/japanese/` as TypeScript modules.

**Missing:** everything else. This is the largest schema change in the document.

**Design** per ADR-004: `Language` and `Course` documents, `LanguagePack` interface,
`lang` becomes a reference. A pack declares its item kinds, its exercise-type support, its
script/direction metadata, and its own validation specs.

**The part that is genuinely hard, and is not schema:** the Japanese content is not
portable and should not be. `romaji.spec.ts` transliterates 802 words and compares against
authored romaji so that every divergence must be a listed exception rather than a typo.
`vocab-everyday.spec.ts` refuses any word using characters no unit has taught, and refuses
any lemma an earlier unit owns — which is what keeps はな "nose" from silently overwriting
はな "flower", since `lemma` is the upsert key. These tests encode Japanese pedagogy. A
Spanish pack needs its own equivalents, and there is no generic version of them.

So the honest framing: the schema work makes a second language *possible*; the content
and its guard-rails are the real cost, and they are per language.

**Cost:** medium for the schema, very large per additional language. A second language is
not a sprint.

**Recommendation:** do the schema work in Phase 2 because it is cheap now and expensive
later, and do **not** add a second language until the platform work is done. Building the
generalisation and then continuing to ship one language is the correct order; it is also
the order in which the generalisation is most likely to be wrong in ways nobody notices,
so the first real test of it should be scheduled deliberately.

---

### 6.6 Sentence-first learning, immersive reading, and the dictionary

**Exists:** grammar points carry `examples[]` with sentence, answer, romaji and gloss.
That is the whole of it — 12 points, a handful of sentences each.

**Missing:** a `Sentence` content type, a corpus, a reading surface, an instant dictionary,
grammar analysis of arbitrary text, and vocabulary collection from reading.

**The blocker nobody can design around: Japanese has no spaces.** Instant dictionary
lookup on tap requires knowing where the word boundaries are, and that requires
morphological analysis. OPEN-ITEMS #23 already hit this from the other direction —
correction-to-SRS matching is substring-based, and single-character lemmas (に, ご, め, て)
are excluded entirely because に is both "two" and the commonest particle in the language,
so matching it would schedule the number every time a particle was corrected. That
compromise costs four words and removes a whole class of false positive. It does not scale
to reading arbitrary text.

**Three options:**

- **`kuromoji.js`** — a real morphological analyser, MIT licensed, pure JS, no service.
  Ships a ~20MB dictionary. Correct, and a dependency decision (§12 Q5).
- **A cloud NLP API** — recurring cost per call and a network hop on every tap. Wrong
  shape for this feature.
- **Longest-match against the known vocabulary** — no dependency, works for text built
  from taught words, fails on inflected forms (たべます will not match たべる) and on
  anything outside the corpus. Adequate for curated reading passages only.

**Recommendation:** longest-match first, scoped to curated passages built from taught
vocabulary. That ships the feature, proves the interaction, and defers a 20MB dependency
until arbitrary text is genuinely on the table. Then kuromoji when it is.

Note that curated passages are also the *better* pedagogy at this level — comprehensible
input means text the learner can mostly read, which is by definition text built from what
they know. The technical shortcut and the pedagogical ideal point the same way here, which
is rare and worth taking.

**Cost:** medium for curated reading; large for arbitrary text.

---

### 6.7 Kanji Studio

**Exists, and it is more than it looks:** 104 kanji with on/kun readings, meanings and
stroke counts; KanjiVG stroke-order SVGs served by codepoint with a one-year immutable
cache; a `StrokeOrder` component in both clients; and every kanji chosen so it writes a
word the learner already knows in kana — 山 is not a new glyph, it is how やま is really
written. `kanji.spec.ts` checks every entry against the actual vocabulary, and caught
たべもの on 物 the first time it ran.

**Missing:** radicals, mnemonics, frequency data, handwriting input, JLPT organisation
beyond a tag, and a dedicated surface — the kanji are currently just another lesson type.

**Design.** Radicals are a content addition with a decomposition relation into the concept
graph (`contains`). Frequency is public data. Mnemonics are authored or generated — and if
generated, they go through the review gate of §6.11, because a wrong mnemonic is memorised
wrong and is unusually hard to correct later.

Handwriting recognition is the hard part. The stroke data is already there and is exactly
what a comparison needs: `paths` is in stroke order and is never sorted, because that is
the whole point of the data. Comparing a learner's captured strokes against it —
count, order, direction, rough position — is doable client-side without a model. Getting
it to feel fair rather than pedantic is the work.

**The licence obligation must not be lost.** The outlines are KanjiVG, **CC BY-SA 3.0**.
Attribution is required on every surface that draws them, next to the strokes, and the
share-alike binds the stroke files. `NOTICE` at the repo root records this. A Kanji
Studio that renders them more prominently must carry the credit more prominently, not
less.

**Cost:** medium. Handwriting is the bulk of it.

---

### 6.8 Speaking, pronunciation and shadowing

**Exists:** TTS output only — `tools/generate-audio.py` with Kokoro produces a `.wav` per
word and per kana, served static. Kana audio was added on 2026-07-27 after a live report
that the kana lessons were the only ones with nothing to hear. Kanji deliberately get no
audio, because a kanji has several readings and which applies depends on the word, so
voicing one beside a bare glyph teaches that *that* is how it reads.

**Missing:** all input. No STT, no pronunciation scoring, no recording, no permissions
handling.

**This is where §8's cost model becomes the binding constraint, not a footnote.** The
blueprint is blunt: voice AI cost per user can quietly exceed what a language-app
subscription earns, and a turn's cost is dominated by STT and TTS rather than by the LLM.
An unmetered free tier of voice inverts the unit economics of the entire product.

**Design.** Three separable pieces, in increasing difficulty:

1. **Recording and playback comparison (shadowing).** No AI at all — record, play back
   against the reference, let the learner judge. Zero marginal cost, genuinely useful, and
   it should ship first because it is the cheapest real speaking practice available.
2. **Transcription scoring.** STT the utterance, compare the transcript to the target. Per-
   request cost. Whisper runs locally (`whisper.cpp`) at Stage A for ₹0 and the laptop's
   CPU; a managed API at Stage B. Grades *what was said*, not how well.
3. **Phoneme-level pronunciation scoring.** Grades *how* it was said — pitch accent,
   mora timing, the し/す distinction. Specialist providers, real cost, and the hardest to
   get pedagogically right: too harsh demotivates, too loose does not teach, and the
   blueprint names that tension explicitly as a design principle to hold rather than a
   feature to add.

**Recommendation:** ship (1), evaluate (2) against measured cost on real usage, treat (3)
as a separate decision with its own justification. And per §3.3, this is the one surface
where metering is honest — it is the only feature in the product with a real marginal cost
per use.

**Cost:** (1) small. (2) medium plus ongoing. (3) large plus significant ongoing.

**Also:** microphone permission, audio storage, and retention. §10 says prefer storing the
*transcript*, not the raw audio; if audio must be kept, object storage behind signed URLs
with a short retention window, never in the database. The `StorageService` abstraction
already exists for exactly this, and `LocalStorageService` is the Stage A binding.
Recording learners speaking also widens the PII surface materially — the privacy policy
now landing in the in-flight work has to cover it before the feature ships, not after.

---

### 6.9 Goals and personalisation

**Exists:** nothing. `activeTrack: 'ja'` is the only personalisation, and it has one value.

**Missing:** goal selection, goal-weighted content, and a placement test. Blueprint §13
item 1 names the gap precisely: the placement test is on the product map, but *the
designed first five minutes* is blank — pick your why, get one fast win before any
friction, land on a filled-in home screen rather than an empty one. Whether a new user
finishes lesson 1 and returns on day 2 predicts nearly everything downstream.

**Design.** Goals are tags on content plus weights in session composition (§6.1), not
separate curricula — separate curricula multiply the content authoring burden by the
number of goals, which is unaffordable and also unnecessary. A learner whose goal is
"anime" gets the same course with casual-speech items weighted up and business vocabulary
weighted down.

A placement test is an adaptive quiz over the concept graph: start mid-course, binary-search
on correctness, seed `LearnerItemState` from the results. It is straightforward *once* the
graph and the learner model exist, and impossible before — which is why it sits here rather
than earlier.

**Cost:** small for goals, medium for placement, small-but-high-value for onboarding.

---

### 6.10 The lesson builder and community publishing

**Exists:** nothing. Content is TypeScript in `seed/japanese/`, authored by one person.

**Missing:** all of it — authoring UI, validation, a review queue, versioning, publishing,
permissions, moderation, attribution, licensing.

**This is the largest single item in the document and the one most likely to be
underestimated.** The authoring UI is the easy part. What community publishing actually
requires is a content moderation system, and §13 item 2 already says the existential risk
of an AI-content language app is confidently teaching wrong Japanese. Community content
has the same failure mode with more volume and less accountability.

Prerequisites, all of them hard blockers:

- content versioning, so a bad edit is traceable and reversible;
- a review gate before anything reaches a learner;
- the report action (in flight — good);
- a moderation queue that a human actually reads. OPEN-ITEMS #31 is candid that social
  reports are currently write-only: `status` starts `open` and nothing moves it, there is
  no queue, no notification, no review UI, and the rows are readable with `mongosh` and
  that is the whole of it. That is defensible at 32 accounts, mostly the operator's own,
  and it stops being defensible the moment strangers arrive — because a report nobody
  reads is a promise the app is not keeping, and the UI does promise it.
- a licence decision on contributed content, which is a legal question, not a technical
  one.

**Recommendation: defer this past Phase 2 entirely.** Build content *versioning* now
(cheap, needed anyway for AI generation and for rolling back a bad seed), and treat
community publishing as its own phase with its own plan. Shipping it half-built is worse
than not shipping it: a review queue nobody reads is how a platform teaches a thousand
people something wrong.

**Cost:** very large. Months, and an ongoing operational commitment rather than a
one-time build.

---

### 6.11 AI-generated lessons

**Exists:** the AI infrastructure (`AiOrchestratorService`, provider abstraction, schema-
constrained output). No generation of curriculum.

**Missing:** generation, validation, review, versioning, publication.

**Design — the pipeline, where every stage is mandatory:**

```
scenario/topic prompt
    ↓  generate (LLM, schema-constrained)
draft: vocabulary, grammar points, dialogue, quiz items, review cards
    ↓  machine validation
      - only characters the course has taught      (vocab.spec.ts's rule, at runtime)
      - only vocabulary the learner has met, or explicitly introduced here
      - romaji matches the transliterator, or is a listed exception
      - no duplicate lemma against existing content   (the はな problem)
      - grammar examples have exactly one ＿ gap and one unambiguous answer
    ↓  human review gate                            (§13 item 2 — not optional)
    ↓  versioned publish
```

**The machine validation stage is where this project has an unusual advantage.** The rules
above are not new work — they are the seed specs, which already exist, already run in CI,
and have already caught real errors: three words needing untaught marks, たべもの on 物,
and every romaji divergence across 802 words. Turning them from build-time tests into
runtime validators is genuinely a refactor rather than a design problem, and it means
AI-generated content is held to the same standard as hand-authored content by the same
code. Very few projects attempting this have that.

**The grammar gap constraint is subtle and load-bearing.** 「わたしはいき＿。」is
grammatical with ます, ません *and* ました, so the question text must state which meaning
is wanted or the question has three right answers. A generator will produce ambiguous gaps
constantly. The validator must check that the gloss disambiguates, which is itself an
LLM judgement — so this is a generate-then-verify loop with a second model, not a regex.

**Cost:** medium for generation, large for doing it safely.

**Gate:** do not ship this before the report action, versioning, and a review queue exist.
Two of those three land in the in-flight work.

---

### 6.12 Analytics that measure learning

**Exists:** an append-only `events` collection since M4, `countTodayByType` for the daily
summary, and the in-flight `getReviewAnalytics`. Learner-facing: XP, level, streak, daily
goal, reviews and lessons done today.

**Missing:** retention over time, vocabulary size, grammar mastery, reading speed,
listening comprehension, speaking accuracy, estimated proficiency. And separately — the
operator-facing side: activation funnel, day-1/7/30 retention, where people quit. §13 item
3 is blunt that you cannot improve what you cannot see, and there is currently nothing
telling Aakash what is working.

**Heed OPEN-ITEMS #30.** `countTodayByType` fetches a 48-hour window and filters in memory
by local date string, deliberately, to avoid deriving a UTC offset for an IANA zone —
which is the DST-boundary bug class of #18. That choice is correct for one user and one
day, and the note says so explicitly: *the moment a question spans users or a longer
period, this shape is wrong and wants a real aggregation.* The stated risk is that the
next daily-ish number gets bolted onto it because it is the closest thing available. Every
metric in this section spans users or periods. **Build the aggregation path separately;
do not extend `countTodayByType`.**

**Design.**

*Learner-facing.* Vocabulary size = count of `LearnerItemState` at familiar or above.
Retention = the memory model's `R`, already computed. Grammar mastery = per-concept
rollup. Estimated proficiency = a mapping from mastered-item counts onto JLPT levels,
which is defensible because JLPT levels are *defined* by vocabulary and kanji counts —
N5 is conventionally ~800 words and ~100 kanji, which is exactly what the course now
teaches. That makes the estimate honest rather than invented, and it should be presented
with its basis shown.

*Operator-facing.* Real Mongo aggregations over `events`, with the `{type, ts}` index,
run on a schedule (ADR-006) into a small rollup collection rather than on demand.

**Cost:** medium. Mostly aggregation-writing.

**Presentation matters more than usual here.** The existing code already gets this right
in a small way worth copying: the daily line reads "Nothing studied yet today" on an empty
day rather than "0 reviews, 0 lessons", because a scoreboard of zeros is the wrong thing
to put on the first screen someone opens. A retention chart showing decay is
demotivating framed as failure and useful framed as "here is what to review". Same data,
opposite effect.

---

### 6.13 Offline-first and sync

**Exists:** nothing. Both clients are online-only. The app shows an offline state when the
API is unreachable, which is intended behaviour rather than a crash, and that is the
entirety of the offline story.

**Missing:** local storage, downloadable courses, an offline review queue, a sync protocol,
conflict resolution, and cache invalidation.

**This is the second-largest item and the one with the deepest architectural reach**,
because it changes the API from a source of truth into a replication peer.

**What conflicts, and what does not:**

| State | Conflict risk | Resolution |
|---|---|---|
| Content (lessons, items, audio, strokes) | none — read-only, immutable, already immutable-cached | download and version |
| SRS grades | **high** — same card graded on phone and web | ordered replay by timestamp; FSRS is deterministic |
| XP / streak | medium — counters | server-authoritative, client optimistic |
| Lesson completions | low — idempotent already | replay |
| Chat | none — requires network by definition | no offline mode |

**The SRS case is the whole problem, and it has one good property:** `ts-fsrs` is a pure
function of `(card, now, grade)`. So an offline grade queue is a list of `(cardId,
grade, timestamp)`, and sync means replaying them **in timestamp order** against the
server's card. Replaying out of order produces a different card state, which is why the
timestamp must be captured at grade time on the device and trusted, and why device clock
skew is a real correctness concern rather than a cosmetic one.

Two existing decisions make this harder and need to be revisited together:

- XP is due-gated. Grading a card that was not actually due awards nothing — that closed
  a farming hole (OPEN-ITEMS #0b). Offline, "was it due" is evaluated against a stale
  local view, so a replayed grade can disagree with the server about whether it earned XP.
- The daily/streak arithmetic runs on local date strings in the learner's zone, and
  OPEN-ITEMS #18 already documents that changing timezone backwards across the date line
  resets the streak. Offline replay introduces the same class of problem without moving.

**Recommendation:** stage it. (1) Offline *content* — download a course, read lessons, no
writes. Substantial value, near-zero conflict risk, and it works with the immutable
caching already in place. (2) Offline *review* with a replay queue. (3) Full bidirectional
sync, if ever. Most of the user-visible benefit is in (1).

**Cost:** (1) medium. (2) large. (3) very large.

---

### 6.14 The cross-cutting layer

Not features, and therefore the things that get skipped. §13 of the Phase 0 blueprint made
the same point and was right.

**API versioning** — ADR-007. Before the next breaking change, not after.

**Background jobs** — ADR-006. BullMQ over the existing Redis. Unblocks analytics
rollups, AI generation, TTS pre-generation, notifications, proficiency recomputation.
Closes OPEN-ITEMS #17.

**Caching** — Redis is present and used for sessions and rate limiting only. Phase 2 adds
obvious cache targets: the memory model (changes only on review), generated explanations
(the explanation of は is the same for everyone at a level), lesson content (immutable),
and readiness scores. This is also a direct cost lever per §8.

**Testing** — 2932 tests in `api/`, and **zero in `client/`**, where the gate is
`typecheck` plus a successful `expo export`. The app is where the learner actually is. As
adaptive logic moves into client-side session state, that gap becomes the riskiest one in
the project. `web/` similarly gates on `tsc -b && vite build`.

**Localization** — the UI is English-only. §13 item 8 names the real requirement: a Hindi
speaker learning Japanese, not only an English base. Also a **furigana toggle**, which
that item is careful to call pedagogically essential for Japanese rather than a nicety.
Note the existing romaji rule is the same shape of decision and already resolved well:
romaji up to N4, none after, with the display rule living in the clients
(`web/src/romaji.ts`, `client/lib/romaji.ts`) while the data stays complete. Furigana
should follow that precedent exactly.

**Accessibility** — untested. `web/CLAUDE.md` already carries the rule that matters most
and computes rather than estimates its contrast ratios: glass surfaces are translucent,
**text never is**. Screen reader support for Japanese text with mixed scripts is genuinely
hard and genuinely unaddressed. Note also that reduced-motion has stranded content in a
sibling project before — it is a known failure mode in this codebase's UI patterns.

**Performance** — the two concrete items are in §6.1 (the N+1 readiness query and the
O(30N) forgetting curve). Beyond those, the hot query remains `{userId, due}` and it is
already index-served with no in-memory sort. Protect that.

**Monitoring** — `GET /health` with live Mongo and Redis checks, plus journalctl. No
metrics, no alerting, no error aggregation. A laptop-hosted service that goes down when
the lid closes needs to tell someone. Note the operational precedent from the sibling
projects on this machine: when sites are down, check `tailscale status` before docker —
tailscaled has wedged before and the symptom looks identical to an app crash.

**Documentation** — genuinely excellent and unusually so; the reasoning-at-point-of-
decision style in `CLAUDE.md` and `OPEN-ITEMS.md` is the single best asset this project
has for surviving a long build. **Maintain it as a hard requirement, not a courtesy.** The
API contract section in the root `CLAUDE.md` says it directly: if you change a response
shape in `api/`, update the contract in the same commit, then update the clients. Drift
there is called out as the most likely bug in the project, and Phase 2 changes response
shapes constantly.

---

## 7. Cost, updated

§8 of the Phase 0 blueprint modelled one AI surface: a chat turn. Phase 2 adds several,
and the shape of the bill changes.

| Surface | Frequency | Cost driver | Control |
|---|---|---|---|
| Chat turn | per message | LLM in+out | history cap (12), message cap (500 chars) — both live |
| Explain-mistake | per wrong answer | LLM, small | **cache by (item, level)** — high hit rate |
| Why-question | on demand | LLM | cache by concept |
| Example generation | on demand | LLM | cache by (item, known-vocab bucket) |
| Lesson generation | rare, operator | LLM, large | offline job, human-gated |
| STT | per utterance | audio seconds | local Whisper at Stage A |
| TTS | per phrase | characters | **already solved** — pre-generated, static, immutable |
| Pronunciation scoring | per utterance | specialist API | premium-metered |

**Two things are true and worth stating plainly.**

The explain-mistake surface is the highest-frequency new AI call in the product — every
wrong answer is a candidate — and it is also the most cacheable, because the explanation
of why へ is *e* and not *he* as a particle does not vary by learner. Get the caching right
before shipping it, or it becomes the dominant line in the bill for a feature that did not
need to be.

TTS is already solved in a way worth noticing: audio is generated once by a local tool,
served static with a one-year immutable cache, and costs nothing per play. That is the
model every other media surface should follow.

**During Stage A this can remain ₹0.** Gemini's free tier covers current traffic, Kokoro
runs locally for TTS, Whisper can run locally for STT. Use the free window for what §8
says it is for — *measuring real token and audio volume per session* — and set the tier
caps from measurements rather than from guesses. That measurement should itself be a task,
not a hope.

---

## 8. The process — stages, gates, and order

Stages are ordered by dependency. Each has an entry condition, an exit condition, and a
reason for its position. **One milestone at a time; stop and report before chaining
ahead** — that rule is in every `CLAUDE.md` in this repo and it applies to this plan too.

---

### Stage 0 — land the pile and clear the decisions

**Nothing else starts until this is done.** It is a week at most, and everything after it
builds on it.

1. **Restore the two deleted docs.** `git checkout -- PHASE-0-BLUEPRINT.md OPEN-ITEMS.md`.
2. **Answer §3.** Hearts, leagues, and the premium boundary. These change what gets built
   and what gets deleted; they cannot be deferred past the first commit that touches
   gamification.
3. **Review and commit the in-flight work.** It typechecks and passes 2932 tests, but it
   has never been reviewed and it is large. Worth splitting into reviewable commits along
   its natural seams: compliance (deletion + legal + reporting), the learning engine, the
   plugin registry, CI.
4. **Verify the new endpoints live**, not by reasoning about them. This repo's own standard
   — the seed bug in OPEN-ITEMS #20 was fixed *and verified by running it*, and the T1.8
   timezone disagreement was caught by checking a live account rather than by reading
   code. `DELETE /me` in particular deletes real data across six collections and must be
   exercised against a scratch database before it goes near a live one.
5. **Update the `CLAUDE.md` files** — the Phase 0 scope boundary (§3.4), the API contract
   for every new route, and a Phase 2 section.
6. **Take a verified backup**, because Stage 1 starts migrating.

**Exit:** working tree clean, CI green on `main`, §3 answered in writing, new routes
verified live.

---

### Stage 1 — foundations that everything else needs

Ordered by what blocks the most.

1. **Background jobs (ADR-006).** Blocks analytics rollups, generation, notifications.
   Needs dependency approval.
2. **API versioning (ADR-007).** Cheapest now; a breaking change without it is unfixable
   on an installed APK.
3. **The concept graph rebuild (ADR-005).** Blocks grammar dependencies, placement
   testing, and adaptive selection.
4. **`LearnerItemState` (ADR-003).** Blocks everything adaptive. Move
   `totalReviews`/`correctReviews` off `SrsCard` before they hold data worth migrating.
5. **The `Language`/`Course` schema layer (ADR-004).** Not because a second language is
   near, but because retrofitting it after Phase 2's content grows is materially worse.
6. **Fix the three engine defects** in §6.1 while the code is fresh.

**Exit:** a learner model that records evidence on every answer; a concept graph that
asserts only true relationships; jobs running off the request path; `/v1` frozen.

---

### Stage 2 — the adaptive core

This is the stage that delivers the thesis. Everything before it was scaffolding.

1. Confidence and mastery computation from real evidence.
2. Weighted session composition (§6.1), preserving determinism.
3. Adaptive review batching — replace "20 oldest due" with the weighted pool.
4. Readiness-gated progression replacing the fixed chain.
5. **Explanations on every adaptive decision.** Not optional; see the risk note in §6.1.
6. Complete the exercise plugin abstraction (§6.4) and fix the distractor pool
   (OPEN-ITEMS #29).

**Exit:** two learners with identical completion records get measurably different sessions,
and each can see why.

---

### Stage 3 — the tutor

1. **Replace the static target-word list with real retrieval** (OPEN-ITEMS #23). Do this
   first — highest value per line in the document.
2. `explain-mistake`, cached hard.
3. `why-question`, `simplify`, `generate-examples` with known-vocabulary validation.
4. Chat history persistence and retrieval.
5. Language comparison, once native language is more than a stored string.

**Exit:** a wrong answer produces a specific explanation of *that* mistake, in vocabulary
the learner has met.

---

### Stage 4 — depth on the surfaces that exist

1. Kanji Studio: radicals, frequency, mnemonics, decomposition edges (§6.7).
2. Handwriting comparison against the KanjiVG data already served.
3. Curated reading passages with longest-match dictionary lookup (§6.6).
4. Vocabulary collection from reading.
5. Shadowing — record and compare, no AI (§6.8 item 1).
6. Goals, goal-weighting, placement test, and the designed first five minutes (§6.9).

**Exit:** the product has surfaces beyond the lesson chain that a learner would open on
purpose.

---

### Stage 5 — measurement

1. Aggregation path, separate from `countTodayByType` (§6.12).
2. Learner-facing: retention, vocabulary size, grammar mastery, proficiency estimate.
3. Operator-facing: activation funnel, retention cohorts, drop-off points.
4. Content versioning — needed here, and a prerequisite for Stage 6.

**Exit:** Aakash can answer "is this working" with data, and so can a learner.

---

### Stage 6 — the expensive, deferrable half

Everything here is real and none of it is next. Each needs its own plan.

- Offline content download (§6.13 stage 1) — the highest-value item in this group.
- Offline review with replay queue.
- STT and pronunciation scoring, gated on measured cost.
- AI lesson generation, gated on versioning + review queue.
- A second language, as the first real test of ADR-004.
- Full bidirectional sync.
- Community publishing and the moderation system it requires (§6.10) — **defer past Phase
  2 entirely.**
- Localization and furigana.
- Billing.

---

### What this sequencing deliberately refuses

**No second language before the platform work is done.** Adding Spanish now means doing
every Phase 2 change twice.

**No community content before moderation exists.** §6.10.

**No voice before the cost is measured.** §8, and the reason §12 put the paywall where it
did.

**No offline before the adaptive engine is settled.** Syncing a model that is still
changing shape means migrating replicated data on every device.

---

## 9. Verification

The standard this repo already holds itself to, stated so Phase 2 does not drop it.

**Verify by running, not by reasoning.** The precedents are explicit and good: the seed
bug was fixed *and verified by running the seed*, checking that a second run left every
`_id` byte-identical; the FSRS intervals in the README are measured output, not predicted;
the Gemini model choice came from a table of what three model names actually returned on
the free tier that day; the timezone disagreement in T1.8 was caught on a live account.

**Dated verification in the contract.** The API contract in `CLAUDE.md` carries a note
saying it was verified against the running API on a specific date, and that the version
before it was written from the blueprint rather than the code and was wrong about nearly
every response. Keep that discipline. A contract nobody checked is worse than no contract.

**What Phase 2 adds:**

- **Client tests.** Zero exist. As session logic moves client-side this is the largest
  testing gap in the project.
- **Determinism tests for adaptive selection.** Same inputs, same session. This is the
  property that keeps exercise generation honest today and it must survive adaptivity.
- **A seed idempotency test** (OPEN-ITEMS #10) — "seed twice, ids unchanged". Required
  before the first content migration.
- **Migration tests against a restored backup**, using `scripts/verify-restore.sh`, which
  already builds a scratch database.
- **Cost assertions.** A test that fails when a request path makes more provider calls
  than budgeted. Cheaper than discovering it on a bill.

**On the test suite's speed:** timings swing wildly on this machine — the same suite has
measured 5.9s and 22s on consecutive runs, because Jest spawns a worker per core and
thrashes under load. `--maxWorkers=2` is usually *faster* under contention, and the CI
workflow already uses it.

---

## 10. Risks

Ordered by expected damage.

**1. Scope. This is the one that kills it.** Fifteen initiatives, one developer, evenings.
The Phase 0 blueprint's own §17 warning applies exactly: building for problems of scale and
organisation you do not have costs the one thing a solo builder must protect, which is the
time to ship. *Mitigation:* the stage gates in §8, and a standing willingness to stop after
Stage 3 with a genuinely better product than exists today.

**2. Adaptive selection that feels arbitrary.** A fixed chain is legible; a bad adaptive
engine is confusing and cannot be diagnosed by the person suffering it. *Mitigation:*
mandatory explanations, plus a debug endpoint that dumps the reasoning.

**3. Teaching wrong Japanese at volume.** §13 item 2's existential risk, multiplied by AI
generation and community content. *Mitigation:* the seed specs as runtime validators
(§6.11), the report action, a human gate, and versioning to roll back.

**4. Cost inversion on voice.** §8's core warning. *Mitigation:* measure before building,
meter what has marginal cost, cache what does not.

**5. Migration data loss.** Real accounts with real scheduling state that does not
regenerate. Seeded content regenerates with `npm run seed`; accounts do not. *Mitigation:*
verified backup before each migration, additive-then-destructive in separate commits, and
`_id` preservation tested rather than assumed. Note the backup caveat: same disk, so it
protects against a bad migration and not against losing the machine.

**6. Contract drift across three clients.** Already called the most likely bug in the
project, with a shipped precedent — the `dateOfBirth` change 400s older builds.
*Mitigation:* ADR-007, and the same-commit contract rule.

**7. Module boundary erosion.** Cross-cutting reads multiply in Phase 2, and the one rule
that makes extraction cheap is the first thing to go. *Mitigation:* the
`AccountDeletionService` pattern — orchestrate from above, never reach sideways.

**8. Operational fragility.** One laptop, systemd user units, a funnel that has wedged
before, no alerting. *Mitigation:* monitoring in §6.14, and knowing that
`quantx-trader.service`-style "not enabled at boot" gaps are the failure mode on this
machine.

---

## 11. What this document does not cover

Named so their absence is a decision rather than an oversight.

- **Business model beyond §3.3's reconciliation.** Pricing, conversion, GST, Razorpay
  mechanics — §13 item 6 has the shape; this is not the document for it.
- **Team.** Everything here assumes one developer. It changes materially with two.
- **Stage B migration.** The blueprint's §11 covers it and the trigger has not fired.
  Note the licence constraint: Tailscale Personal is non-commercial only, so Stage B is
  mandatory before charging anyone.
- **Marketing, launch, growth.**
- **Detailed UI design.** The design principles exist in `web/CLAUDE.md` and
  `client/CLAUDE.md`; screen-level design belongs with the screens.
- **AR, VR, and the teacher portal.** In the v3 vision, not in this plan.

---

## 12. Open questions — these need Aakash

Numbered for reference in commits and future sessions. **Q1–Q3 block Stage 0.**

**Q1. Hearts and gems — remove, disable, or repurpose?** (§3.1) My recommendation:
remove, and rebuild the useful signal inside the learner model. Blocks any gamification
work and any philosophy statement in the README.

**Q2. Leagues — keep, promotion-only, or opt-in?** (§3.2) My recommendation:
promotion-only and opt-in.

**Q3. Where does the premium boundary sit?** (§3.3) My recommendation: on marginal
per-user cost only — voice and unlimited generation metered, everything that teaches free.
Requires amending blueprint §12, which currently says otherwise.

**Q4. Which language is second, and when?** (§6.5) The answer changes what the schema
generalisation must accommodate — a second character-based language is a very different
test from a Latin-script one.

**Q5. `kuromoji.js`?** (§6.6) A ~20MB dictionary for real morphological analysis. My
recommendation: not yet — longest-match over curated passages first.

**Q6. BullMQ?** (ADR-006) Already in the blueprint's architecture diagram, running on
Redis that is already a dependency. My recommendation: yes, in Stage 1. Needs explicit
approval per the no-new-dependencies rule.

**Q7. How far does Phase 2 actually go?** (§8) Stages 0–3 are a coherent product that
delivers the thesis. Stages 4–6 are each a phase in their own right. Deciding the stopping
point now prevents the plan from quietly becoming infinite.

**Q8. What happens to the 30-odd existing accounts** through the migrations? They hold
real scheduling state. Specifically: gem balances if Q1 is "remove", and league standings
if Q2 changes.

**Q9. Does the operator-facing analytics surface exist as a UI**, or is `mongosh` enough
for now? (§6.12) The honest answer today is that reports are already write-only and read
with `mongosh` (OPEN-ITEMS #31), so there is precedent for "no UI" — but that precedent is
explicitly marked as expiring when strangers arrive.

---

## Appendix A — open items this plan carries or closes

**Closed by the in-flight work:** #5 / #32 (`DELETE /me`), #8 (report a mistake), #7
second half (privacy + terms), #4a (client-supplied attempt).

**Closed by this plan:** #9 (quadratic character edges → ADR-005), #17 (synchronous
analytics → ADR-006), #23 (static chat target words → Stage 3), #29 (distractor pool →
Stage 2), #10b's remaining half (recognition vs. recall → `byExerciseType` in §5.2),
#10a (exercise generation moving to `learning` — §6.1 makes it need learner state, which
is the stated signal for the move).

**Carried, unresolved:** #1 (unauthenticated lesson routes), #2 (one throttle for three
auth routes), #3 (rate limiting fails open), #4 (no refresh-reuse family revocation —
`revokeAll` exists and is unwired), #6 (backups share a disk), #10 (seed idempotency
untested), #10c (silent option-count degradation), #11 (`strictPropertyInitialization`
off), #12 (no linter), #13 (Mongo on 27018), #14 (`isolatedModules`, and the `@Prop`
explicit-`type:` rule that follows from it), #18 (timezone streak edge), #22 (no IANA
picker), #24 (chat transcript retention), #27 (web tokens in localStorage), #30 (the
analytics read path is not a foundation), #31 (nobody reads reports).

**Note on #4:** unwired reuse-detection revocation is the cheapest real security
improvement available — the method exists, it is one call in the `!consumed` branch. Worth
doing in Stage 0 alongside everything else.

---

## Appendix B — where the code changes

Approximate blast radius per stage, for planning.

| Stage | api/ | client/ | web/ | content | migrations |
|---|---|---|---|---|---|
| 0 | review only | — | — | — | none |
| 1 | new module + 4 schema changes | — | — | seed rewrite (edges) | 3 |
| 2 | learning, content, knowledge-graph | session screens | quiz | none | 1 |
| 3 | ai-orchestrator, chat | chat + lesson screens | — | prompt content | 1 |
| 4 | content, media, new modules | 3–4 new screens | reading surface | large authoring | 2 |
| 5 | analytics, new rollups | stats screens | stats | none | 1 |
| 6 | wide | wide | wide | wide | many |

---

*Written 2026-07-27 against commit `46146b3` plus the uncommitted working tree described
in §1.3. Verified: `npm run typecheck` clean, `npm test` 33 suites / 2932 tests green.
If you are reading this after the in-flight work has landed, re-verify §1 before trusting
it — this document's own standard is that a spec written from reasoning rather than from
the code is wrong about nearly everything.*
