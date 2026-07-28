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

> **Verified against the running API on 2026-07-26.** GET routes were probed live;
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
POST /auth/register  { email, password, displayName, dateOfBirth, nativeLanguage?, tz? }  -> 201
POST /auth/login     { email, password }                                     -> 200
     both -> { user: <UserResponse>, tokens: { accessToken, refreshToken, expiresIn } }

POST /auth/refresh   { refreshToken }  -> 200
     -> { accessToken, refreshToken, expiresIn }        // flat, NOT nested under `tokens`
```

`displayName` is required, 1–60 chars. `password` is 8–128, `email` ≤254.

**`dateOfBirth` is required** (ISO `YYYY-MM-DD`), added 2026-07-26 with the social
features. Under-13 registration is **400**. The check runs before the email lookup
and before argon2, so an under-age attempt neither spends a hash nor learns whether
an address is taken. It is required by the DTO but **optional on the schema** —
making it required would have invalidated every account created before it existed.
Absent means "unknown age", which every age check treats as a refusal rather than a
pass. **This is a breaking change for any client built before it**: an old build
sends no `dateOfBirth` and gets a 400.

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
PATCH /me/settings   bearer  { audioSpeed?, theme?, tz?, dailyGoalXp?, leaderboardOptIn? }  -> <UserResponse>
GET   /me/progress   bearer -> { xp, level, xpIntoLevel, xpForNextLevel,
                                 streakDays, lastStudyDate,
                                 daily: { xpToday, goalXp, percentOfGoal, goalMet,
                                          reviewsDone, lessonsDone },
                                 cardsDueNow, lessonsCompleted, completedLessonIds }

UserResponse = { id, email, createdAt,
                 profile:      { displayName, nativeLanguage, activeTrack: 'ja' },
                 gamification: { xp, streakDays, lastStudyDate, dailyGoalXp },
                 settings:     { audioSpeed, theme, tz, leaderboardOptIn } }
```

`PATCH /me/settings` returns the **whole user**, not just the settings block.
`audioSpeed` is 0.5–2.0, `theme` is `light`/`dark`/`system`, `tz` an IANA zone name,
`dailyGoalXp` an integer 10–1000, `leaderboardOptIn` a boolean defaulting to
`false` (Phase 2 §3.2 — the weekly leaderboard is opt-in).

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

`daily.reviewsDone` and `daily.lessonsDone` were added 2026-07-26 (T1.8). They are
counted from the **event log**, not from a stored counter, and on the user's own
local day, from the same `now` as `xpToday`. They exist because XP alone is
ambiguous: 30 XP is three lessons or fifteen reviews, and "nothing done yet" and
"reviews done, goal just set high" are different things for a client to say.
Counting is a 48-hour window filtered by local date string rather than a Mongo
range on local midnight, deliberately — deriving a UTC offset for an IANA zone is
the DST-boundary bug class of OPEN-ITEMS #18.

**`xpToday` and these two counts can disagree after the learner changes
timezone**, and it is worth knowing which to trust. `xpToday` compares the
*stored* `lastStudyDate` — a string written under whatever zone was in effect at
the time — against local today, so a zone change makes it read 0 for a day the
learner did work. `reviewsDone`/`lessonsDone` re-derive from event timestamps, so
they stay right. Verified live: the same account reads `xpToday: 0` in
Pacific/Kiritimati and `16` in Pacific/Niue while both counts stay at
`reviewsDone: 3, lessonsDone: 1`. Same root cause as #18; within a fixed zone the
three agree.

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

### Audio — no bearer

```
GET /content/vocab/:id/audio  -> audio/wav
GET /content/kana/:id/audio   -> audio/wav
```

Both read the same `audio/<item id>.wav`; the routes differ only in what the
caller calls the item, so a kana is never requested as a vocab. Generated by
`tools/generate-audio.py --collection {vocab,kana}`, served static with a
one-year immutable cache. A missing file is a **404**, and the client's fallback
is silence — the written form is already on screen.

**Kana were added 2026-07-27** after a live report that the kana lessons were
the only ones with nothing to hear. They had been left out on the reasoning that
romaji already spells the sound, which is true only for someone who reads
romaji — and the first unit exists to stop needing it.

**Kanji still get no audio**, for an unrelated reason that has not changed: a
kanji has several readings and which applies depends on the word (山 is やま
alone and サン in 火山), so voicing one beside a bare glyph teaches that *that*
is how it reads. A kana has exactly one reading, which is what makes it safe.

**Audio must not be offered where it answers the question.** `vocab` prompts ask
for an English gloss, which listening never reveals, so they play freely.
`wordReading` and **`kana`** prompts do not: both ask for romaji, and the
recording is that romaji spoken. Those wait for the verdict, where the audio
stops being a hint and becomes the correction. The rule lives in
`hasAudio`/`revealsAnswer`, spelled identically in `web/src/audio.ts` and
`client/api/audio.ts`. The study screens are exempt — nothing there is graded.

### Stroke order — no bearer

```
GET /content/strokes/:codepoint  -> { char, viewBox, paths: [ <svg path d>, … ] }
```

Added 2026-07-27. `codepoint` is the character's **lowercase hex codepoint**,
4–5 digits (`あ` → `3042`, zero-padded to `03042` on disk but either accepted).
A client derives it with `codePointAt(0).toString(16)` — no id, no lookup.

**Keyed by character, not by item id** — unlike the audio route. Strokes are a
property of the character, and き is taught both as a kana item and inside きゃ,
while 山 is both a kanji entry and part of words. One file serves them all.
Yōon are therefore *not* stored whole: きゃ is two characters with two stroke
orders, which is also how the clients already render it — two cells, two
diagrams.

`paths` is in **stroke order** — that is the whole point of the data, so it is
never sorted or reordered. `viewBox` is KanjiVG's `0 0 109 109`.

Served static from `api/storage/strokes/`, generated by
`tools/fetch-stroke-order.py`, with a one-year immutable cache — a character's
stroke order does not change. A character with no data is a **404**, and the
intended client behaviour is to show the character with no diagram rather than
an error.

**The outlines are KanjiVG, CC BY-SA 3.0.** Attribution is an obligation, not a
courtesy: every surface that draws them shows the credit, next to the strokes.
See `NOTICE` at the repo root. The share-alike binds the stroke files only and
does not reach the rest of the API.

### Exercises — bearer

```
GET  /lessons/:id/exercises?attempt=  -> { lessonId, unit, title, attempt, questionCount,
                                           questions: [ <Question> ] }
POST /lessons/:id/exercises/:exerciseId/answer   { optionId: 'opt-N' } OR { text }  -> 200
     -> { exerciseId, correct, selectedOptionId, selectedValue,
          correctOptionId, correctValue, prompt }
POST /lessons/:id/complete  -> 200
     -> { lessonId, title, cardsCreated, cardsAlreadyPresent,
          xpAwarded, firstCompletion, totalXp }

Question = { exerciseId, itemId, type, prompt, promptKind, question } with two shapes:
  multipleChoice { ... type: 'multipleChoice', options: [ { id, value } ] }
  wordReading    { ... type: 'wordReading' }  // no options; learner types romaji
```

`itemId` was added 2026-07-27 and is the **content item's own id** — the same
`id` `GET /lessons/:id` returns on the resolved item. It exists because a
question is otherwise anonymous: `exerciseId` is `"{attempt}:{index}"`, a
position in a shuffle, so the only per-item handle a client had was the prompt
string. Its first use is audio in the quiz — `GET /content/vocab/:id/audio` is
keyed by the vocabulary item's id — but it is **sent for every prompt kind, not
just the ones that have a `.wav`**. Which kinds can speak is a display rule, and
display rules live with the clients, same as romaji.

For `grammar` it resolves to the **grammar point**, not the example sentence. A
point contributes at most one question (its first example), so the mapping is
still one-to-one.

`itemId` is always the **asked** item, never a distractor, and it is stable
across attempts where `exerciseId` is not — which is what makes it usable as a
key for per-item client state.

It does not widen what an answer-hunting client can reach. `/lessons/:id` is
unauthenticated and already returns every item with its gloss, romaji, meanings
and grammar answers, and the prompt *is* the item's own text — so that lookup
was always available by string match. This makes an existing path exact rather
than opening a new one. What stays protected is unchanged: which option is
correct never leaves the service (`toPublicQuestion` is still an allowlist), and
`/complete` gates on server-recorded answers rather than on client claims.

`promptKind` is `'kana' | 'vocab' | 'grammar' | 'wordReading' | 'kanji'`
(widened to include `wordReading` on 2026-07-26 with T1.1, when っ/ー + chōonpu
teaching landed, and `kanji` the same day with T1.7). It says what the prompt
*is* so the client can size it — one glyph belongs in a genkouyoushi cell, a
word does not fit in one, a sentence has to wrap, a word typed in romaji sizes
like vocab. A lesson with none of the five kinds still 422s.

`kanji` is its own kind rather than reusing `kana` even though both are a single
glyph: a kanji is much denser (顔 has 18 strokes, the busiest kana has 4), so it
renders at a smaller size and **not** in a genkouyoushi cell — the cell's
quadrant guides are for placing kana being written, and this unit asks for
meaning, not handwriting.

The answer body is a discriminated union on the lesson's `exerciseTypes`:
`multipleChoice` lessons take `{ optionId: 'opt-N' }` and `wordReading` lessons
take `{ text: string }`. Sending the wrong shape is a 400. For `wordReading`
the grader normalises by trim + lowercase + whitespace collapse, then exact
matches against the canonical romaji — no fuzzy matching, because a missed
doubled consonant (e.g. `gakou` instead of `gakkou`) is *the* mistake the
lesson teaches. On `wordReading` answers both `selectedOptionId` and
`correctOptionId` are the empty string; the typed answer is in
`selectedValue`, the canonical romaji in `correctValue`.

| Lesson items | Prompt | Options | `question` |
|---|---|---|---|
| kana | the character | romaji | constant |
| vocab | the word | English glosses | constant |
| grammar | a sentence with a `＿` gap | particles and endings | **carries the English gloss** |
| marks-words | the word (e.g. がっこう) | none — typed | constant (`'How do you read this word?'`) |
| kanji | the character | English meanings | constant (`'What does this kanji mean?'`) |

**Grammar's `question` is per-item and load-bearing.** 「わたしはいき＿。」is
grammatical with ます, ません *and* ました, so the question text states which
meaning is wanted: `Which fills the gap? — "I went to the sea."` Without it the
question has three right answers. Kana and vocab questions are still constant.

**Kanji asks for the meaning, never the reading**, and that is a correctness
constraint rather than a preference: 山 is やま alone and サン in 火山, so a
reading question would have two right answers — the same defect as grammar's
gap. The meaning is what a kanji has independently of context. `on` and `kun`
*are* returned by `GET /lessons/:id` so the lesson screen can teach them; they
never reach the exercise payload, because `toPublicQuestion` is an allowlist.
Multiple meanings are joined into one option (`'sky, empty'`), not offered
separately.

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

**`/complete` has two preconditions.** It returns **409 Conflict** unless (a) every
id in the lesson's `prerequisiteLessonIds` is in the caller's
`completedLessonIds`, **and** (b) the caller has finished some attempt of this
lesson with **every question they were asked answered correctly**.

Gate (b) was tightened on 2026-07-26 from "answered at least one exercise"
(T1.4) after a live report: you could answer everything wrong and still finish,
which made the XP, the "done" tick and the chapter progress all certify
something untrue. Messages are `"Answer the exercises before completing this
lesson."` when nothing was answered and `"Answer every exercise correctly
before completing this lesson."` when answers are outstanding — distinct on
purpose, since telling a learner mid-lesson that they answered nothing is wrong.

**It is not "all correct first try".** Both clients re-ask a question the learner
got wrong until they answer it correctly, so a mistake costs a heart and a repeat
rather than the lesson. That matters because `/complete` is what seeds the SRS
cards: hard-blocking would mean a word the learner got wrong never enters review,
which is backwards — that is the word they most need scheduled.

The check groups attempts **by attempt number** and looks for one with `answered
≥ 1 and incorrect = 0`, so a messy attempt 1 followed by a clean attempt 2 passes,
and abandoning attempt 2 half-done does not un-earn attempt 1. `recordAttempt`
promotes `correct` **false → true only**, never back, so the field means "got this
right at some point during this attempt".

The gate is still server hardening as well as a rule: honest clients satisfy it by
construction, and it stops API-spoof paths — `curl`, replay, a future client that
skips the exercise step — from harvesting XP.

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

**A corrected word becomes a review (T1.5, 2026-07-26).** Sending a message has a
side effect on the learner's SRS: every correction's `span` and `fix` are matched
against taught vocabulary, and each match either gets a new card due now or has
its existing card's `due` pulled forward. **Only `due` is written** — never
`stability`, `difficulty`, `state`, `reps` or `lapses`, because a correction is
not a graded review and inventing a grade would corrupt the scheduler's model.
Nothing about this appears in the response shape; the effect is visible on the
next `GET /reviews/due`. Single-character words (に, ご, め, て) are deliberately
never matched — に is both "two" and the commonest particle, so matching it would
schedule the number every time a particle was corrected. Scheduling never fails a
turn: a failure is logged and the reply is still returned.

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

### Social — bearer

```
GET    /social/users?q=                      -> [ <PublicProfile> ]   (display name prefix, ≥2 chars)
GET    /social/friends                       -> [ <PublicProfile> ]
GET    /social/friends/requests              -> [ { requestId, from: <PublicProfile> } ]
POST   /social/friends/requests/:userId      -> { status: 'pending' | 'accepted' }
POST   /social/friends/requests/:id/accept   -> { status: 'accepted' }
POST   /social/friends/requests/:id/decline  -> { status: 'declined' }
DELETE /social/friends/:userId               -> { removed: true }
GET    /social/messages/:userId              -> [ { id, text, mine, createdAt } ]  (oldest first, 50)
POST   /social/messages/:userId  { text }    -> { id, text, createdAt }
GET    /social/blocks                        -> [ <PublicProfile> ]
POST   /social/blocks/:userId                -> { blocked: true }
DELETE /social/blocks/:userId                -> { blocked: false }
POST   /social/reports  { userId, reason, note?, messageId? }  -> { id }
GET    /social/leaderboard                   -> <Leaderboard>

PublicProfile = { id, displayName, level, xp, streakDays }
Leaderboard   = { week, endsAt, tier, tierName, tierCount,
                  rows: [ { rank, userId, displayName, weeklyXp, isYou } ],
                  yourRank, promotionCount, relegationCount, optedIn }
```

**The leaderboard runs on a UTC week, and that is a deliberate departure** from
everything else time-related here. `lastStudyDate`, `todayXp` and the daily goal
are all measured in the *learner's* zone, because "did I study today" is a
question about their day. A ranking compares people to each other, so it needs one
shared clock — otherwise Auckland and Los Angeles are ranked over windows offset
by nearly a day and whoever's week ends later can always see the target first.
`gamification/week.ts` holds the ISO-week arithmetic; `endsAt` is sent as an
instant so the client never re-derives the boundary.

`weeklyXp` is a counter-plus-period like `todayXp`, corrected on read — reading
the stored value directly is a bug on the first request after a Monday.

**Settlement is lazy and promotion-only** since Phase 2 §3.2 (2026-07-28): the
first `/social/leaderboard` request after a week closes promotes the top
`PROMOTION_COUNT`, and that is all it does. A unique index on
`leagueStandings {week, tier}` makes that exactly-once under concurrency. Only
the immediately preceding week is settled — older gaps cannot be settled
honestly because the totals they need have already been reset.

`promotionCount: 0` means the tier has too few players to settle (below 8) — a
client should say so rather than draw cut-off lines that will not be honoured.
Nobody on zero XP is ever promoted, whatever their rank. `relegationCount` is
always 0 — the field stays on the wire so a future return does not break a
stored client, but no one goes down for finishing last any more.

**The leaderboard is opt-in (also §3.2, 2026-07-28).** `settings.leaderboardOptIn`
defaults to `false`, surfaces on `UserResponse`, and is patched through
`PATCH /me/settings`. The route filters opted-out learners out of `rows` for
every viewer — and an opted-out viewer receives an empty table plus
`optedIn: false` in the response, so the client can render an opt-in card rather
than a board with their name missing.

Added 2026-07-26. `PublicProfile` is a **much shorter allowlist than
`UserResponse`** because it is shown to strangers: no email, no settings, no date
of birth, no lesson history.

**Four rules, all enforced in `SocialService`** so a future route cannot skip them:

1. **A message requires an accepted friendship** — 403 otherwise. There is no route
   by which a stranger opens a conversation. This is why the age minimum can be 13
   rather than 18: the protection is structural, not age-segregating.
2. **A block in either direction disqualifies** messaging, friend requests and
   search results — and the 403 body is byte-identical whichever way the block
   runs, because saying "they blocked you" discloses what a blocker did not agree
   to share. Blocking also deletes the friendship.
3. **Messaging requires a known age** ≥ `MIN_AGE_FOR_MESSAGING` (13). Accounts with
   no `dateOfBirth` get 403 with a message telling them to set one.
4. **Not yourself** — 400 on befriending, messaging, blocking or reporting yourself.

Reading a conversation **re-checks** the friendship, so unfriending or blocking
closes the history rather than only stopping new messages.

Search is by **display name only, never email** — an email search would rebuild the
enumeration oracle `/auth/login` burns a dummy argon2 verify to prevent. Minimum two
characters, capped at 20 rows, throttled at 20/min. Messages are throttled at 30/min.

Reports are **write-only** in this build: `status` is always `open` and there is no
review route — see OPEN-ITEMS #31.

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
- When `PHASE-0-BLUEPRINT.md` or `PHASE-2-BLUEPRINT.md` is ambiguous, ask rather than assume.

## Phase 0 scope boundary

Not building yet: voice/STT/TTS, AR, a second language, teacher portal, marketplace,
social features, offline lesson caching, in-app purchases.

If a task appears to require one of these, stop and ask.

## Phase 2 supersedes the above

`PHASE-2-BLUEPRINT.md` landed 2026-07-27 and §3.4 demands this section be written
*before* any further work, otherwise every future session will correctly refuse it
on the Phase 0 boundary above. The three §3 contradictions have been resolved in
writing and the code changes are committed on `phase-2-foundations`:

- **§3.1 — hearts and gems (removed 2026-07-28, commit 9d70f0b).** The "where a
  learner errs" signal they collected is being rebuilt inside `LearnerItemState`
  in §6.1 / Stage 1. Until that migration lands, the only per-attempt signal
  that survives is the exercise answer record itself.
- **§3.2 — leagues promotion-only + opt-in (2026-07-28, commit c170268).** No
  one goes down for finishing last any more, and a learner has to opt in to
  appear on the board at all. The mechanic and the schema are settled.
- **§3.3 — premium boundary (resolved 2026-07-28).** The paywall sits on
  *marginal per-user cost*, never on learning. Content, scheduling, analytics,
  offline access and text tutoring are free forever — their marginal cost is
  near zero, and putting them behind a paywall contradicts "no premium-only
  learning restrictions". Voice conversation, unlimited AI lesson generation
  and anything that bills per request is metered, because each use costs real
  money and an unmetered free tier of it ends in the product being switched off.
  Nothing that *teaches* is gated.

The Phase 0 "What NOT to build" lists in `client/CLAUDE.md` and `api/CLAUDE.md`
are stale in the items Phase 2 deliberately builds on — chat (already shipped
2026-07-21), social features (already shipped 2026-07-26), offline caching
(§6.3, Stage 1+), voice conversation (§6.8, gated by §3.3). Each of those
files now carries a Phase 2 section that supersedes the Phase 0 list.

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
