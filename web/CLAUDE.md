# Project rules — langapp web

The public website. Vite + React + TypeScript strict, talking to the same API as
the Android app.

**This is a third surface, not a replacement.** `client/` (React Native + Expo)
is the product; this is the shop window. Nothing here should make the app worse
to maintain, and the app's rules do not automatically apply here — see below for
where they deliberately diverge.

## Stack (do not substitute without asking)

- **Vite + React 19 + TypeScript** strict
- **anime.js v4** for animation
- No component library, no CSS framework, no state manager.
- **TanStack Router**, file-based, from `src/routes/` — since commit 3ff0be9
  (2026-07-29). This section said "**no router** — `useRoute.ts` is a thirty-line
  hash router" until 2026-07-30, three weeks after that stopped being true, and
  the drift is not harmless: `useRoute.ts` is now a compatibility *shim* whose
  own comment says not to extend it, and reading this file as authoritative is
  how `#/learn/<id>` came to be hand-written into a button. See the navigation
  rule below.
- **Hash history**, kept from the hand-rolled router and for its reason: it needs
  no server rewrite rule, so the build is plain static files that work from any
  directory on any host. The Funnel mounts this at `/learn/`.

**anime.js is v4.** The API is `animate(targets, params)` — *two arguments*.
Nearly every example online is v3's single `anime({ targets: … })` object, which
compiles and then silently does nothing. Scroll triggers are
`onScroll({ target, enter, repeat })` passed as `autoplay`; there is no `once`
option (`repeat: false` is the one). Check `node_modules/animejs/dist/modules/`
`.d.ts` files before trusting any snippet.

## Auth, and where the tokens live

Browsing the course needs no account: `GET /lessons` and `GET /lessons/:id` are
unauthenticated. Everything that *teaches* — quizzes, completion, reviews,
progress — is behind a bearer token.

Tokens are in **`localStorage`**, and the trade is written out in `auth.ts`:
any script on the page can read them, so an XSS steals a session. That is
tolerable only because the site renders no user-generated content and loads no
third-party script. **Adding a comment box, an analytics snippet or an embed
changes the answer** — at which point the fix is httpOnly cookies, which is an
API change with a tail (cookie issuing, `credentials: true` and therefore a
single strict origin, and CSRF protection becoming mandatory). Logged as
OPEN-ITEMS #27.

**Refreshes must stay serialised.** Refresh tokens rotate — presenting one
consumes it — so concurrent 401s share a single in-flight refresh. Five parallel
requests each firing their own refresh means four of them redeem a token the
winner already burned, and the session dies for no reason. `refreshInFlight` in
`api.ts` is the whole of the fix; do not remove it.

**The API needs `CORS_ORIGINS` set to this site's origin.** Empty by default, so
a fresh checkout gets a page that loads and then fails to fetch — that is the
symptom, and `api/.env` is the fix. The Expo app never needed CORS because a
native fetch is not subject to the same-origin policy.

## Design rules

The palette in `theme.css` is copied from `client/theme/colors.ts` **unchanged**
so both surfaces read as the same product. The identity is washi paper, a
genkouyoushi grid, vermilion and indigo — not glass. Glass is a material applied
*over* that, and it must never become the identity.

**Contrast is a gate, not a preference** — the same rule as the app, and the one
most at risk here. Translucency is where AA usually dies. The rule:

> Surfaces are translucent. Text never is.

Every glass panel has a documented worst-case composited colour
(`--glass-solid`), and text contrast is measured against **that**, not against
the panel's nominal colour. Those numbers in `theme.css` are computed, not
estimated — recompute them if you touch an alpha, a tint, or the page ground.
Dark-mode vermilion already failed this once (4.08:1 on glass) and needed
`--shu-glass`, a lightened variant used only on panels.

This is also the one place the app's "no gradients, no drop shadows" rule is
deliberately relaxed — confined to `.glass` and the single hero wash, so the
exception stays visible. Nothing behind a glass panel may become a photograph or
a strong gradient: the worst-case guarantee depends on the ground staying flat.

**Reduced motion is a hard stop, not a shorter duration.** `prefers-reduced-motion`
disables animation outright. Consequence worth understanding: `.reveal` elements
start at `opacity: 0` **only** when `<html>` has `js-motion`, which `armMotion()`
adds. If JS fails, or motion is reduced, the class is never added and the page
renders fully visible. Never write a bare `opacity: 0` starting state.

## Conventions

- Tokens live in `theme.css`; layout in `app.css`. No colour literals in
  components — the two hero/grid washes in `app.css` are the exception and are
  commented as such.
- Every list has a loading, empty and error state before it is done.
- The API is on a laptop that sleeps. Offline is a normal condition to handle,
  not an exception — copy says what to do, never "something went wrong".
- Prefer native elements. `<details>` for disclosure, not a div with `onClick`:
  it is keyboard operable, announced correctly and findable by in-page search
  while closed.
- Smooth scrolling is CSS `scroll-behavior`, not a hijacked scroll library. A
  rewritten scrollbar breaks keyboard paging, find-in-page and trackpad
  momentum, and nothing here needs frame-level scroll control.
- **The review session's queue is local and the UI never waits.** A grade
  advances the card immediately and the POST catches up behind it, because
  twenty cards must not feel like twenty round trips. The cost is a rollback
  path: a failed grade re-queues the card *once*, never on the last card (the
  summary is already up), and otherwise counts as lost and is reported. Do not
  "simplify" this into awaiting each grade.
- `GradeResult` in `api.ts` matches the server's `GradeReviewResponse` — it
  does not declare `stability` or `difficulty`, so they cannot be rendered.
  The leak rule says FSRS internals must not reach a client; the API enforces
  it server-side.
- **One button system: `.btn` + a `.btn-*` modifier, in `theme.css`.** There
  used to be a second, `.button` in `app.css`, near-identical and quietly
  different in the parts that matter — it had `:disabled` styling and a 48px
  minimum height where `.btn` had neither, and the quiz used both. Don't add a
  third.

## The reward layer (2026-07-29)

Gamification is a *display* of what the server already knows. Three rules, and
the first is the one that will be tempting to break:

- **Never render an XP number the server did not send.** Only
  `POST /lessons/:id/complete` and `POST /reviews/:cardId/grade` carry
  `xpAwarded`. The exercise *answer* endpoint carries none — so a correct answer
  gets `CorrectFlash` (a tick, no figure) rather than an invented "+10 XP",
  which would also be wrong on a practice repeat where the award is smaller.
- **Achievements derive from `/me/progress` alone**, on render, stored nowhere.
  `gamification.ts` names the three badges that were dropped rather than faked
  (night owl, perfect run, lifetime review count) and what each would need from
  the API first. A badge that lights up on a guess costs more trust than the row
  is worth.
- **Level comes from `progress.level`, never recomputed.** The server's curve is
  a flat 100 XP per level and is free to change; a second formula here would
  disagree with every other surface the moment it did. `levelTier` bands *over*
  that number, which is fine — it reads the server's answer rather than
  replacing it.

Confetti is `burstConfetti` in `motion.ts`, hand-rolled — forty absolutely
positioned divs, no dependency. It renders into a fixed layer on `<body>`,
because a burst inside a rounded, overflow-clipped panel is a burst nobody sees.
Silent under reduced motion, and nothing depends on it having run.

## Mnemonics and tracing

`mnemonics.ts` is authored content on the client, for the same reason as
`romaji.ts`: it is display, and the server stays the source of truth for what a
character *is* rather than for how to remember it. Base hiragana and katakana
only — dakuten and yōon fall back to the base character's hook, because the mark
is a rule to learn, not a new shape.

`TraceCanvas` is the **one graded thing on the study screen**, which otherwise
grades nothing. Handwriting has no other feedback channel: reading is checked by
the quiz, writing is checked by nobody, and an unchecked tracing box is
colouring-in. It is entirely local — no XP, no SRS, no request.

`strokeMatch.ts` holds the geometry, pure and DOM-free so the tolerances can be
reasoned about. It works in KanjiVG's `0 0 109 109` space, so the numbers mean
the same thing at any rendered size. Two things worth not breaking:

- **Direction is checked before shape is rejected.** A backwards stroke is the
  commonest real mistake, and "wrong way round" is far more useful than "that
  was off". Direction is half of what stroke order means.
- **The expected geometry is sampled off the rendered `<path>` elements**
  (`getPointAtLength`), not from parsed path data — so what is judged and what
  is drawn cannot drift apart.

`useStrokes` in `strokes.ts` is the single cached fetch per character; the
diagram and the canvas appear together and must not request twice.

## The unit checkpoint (2026-07-29)

`CheckpointQuiz` is the end-of-unit test, and it is **not `LessonQuiz` with a
flag**. They look alike and behave oppositely; every difference is one a shared
component would have to branch on:

- **No verdict panel.** A lesson shows the right answer as soon as you get one
  wrong. A test cannot — later questions can be about the same item. The server
  enforces it by sending `correctValue: ''` on every answer, so there is
  nothing to render even if someone tried. The key arrives at submit, in
  `missed`, which is the only place this surface ever shows one.
- **No audio, anywhere on the screen**, including `vocab` prompts where the
  lesson plays it freely. `hasAudio`/`revealsAnswer` is the lesson's rule; a
  test's is stricter. Relaxing that is a pedagogical decision, not a UI one.
- **Answers are fire-and-forget.** The screen advances on click and the POST
  settles behind it — the same trade `Review` makes, for the same reason. The
  cost is that submit has to `allSettled` the in-flight answers first, because
  the server counts an unanswered question as wrong.

Three rules that must not be re-derived here:

- **`passMark` comes from the server**, on both the set and the result. It is
  not `0.8` in this file. A client with its own copy tells learners they passed
  when they did not.
- **Starting is idempotent.** `startCheckpoint` returns the *open* attempt until
  it is submitted, so mounting twice, refreshing, or navigating back does not
  produce a second test — and cannot be used to re-roll for easier questions.
  Do not add a guard against calling it; the guard is server-side.
- **`responseTimeMs` is sent, and clamped.** This is the first surface that
  sends it (see OPEN-ITEMS #38 — nothing did before, and the field had been
  silently dropped API-side for its whole life). Anything over five minutes is
  omitted rather than sent: the stats are cumulative running means, so one
  sample from a tab left open overnight sits in that item's average for a very
  long time.

The curriculum offers the test only once every lesson in the unit is complete.
Not gated — the API will run one on a barely-started unit, which is right for a
future placement probe and wrong as the default affordance.

## Navigate with `<Link to>`, never a hand-written `href="#/…"` (2026-07-30)

The hash is the router's address bar. Writing it by hand is unchecked by
everything — `tsc`, `oxlint` and `vite build` were all green while the home
page's **"Begin" button pointed at `#/learn/<id>`, a path no route matches**.
`learn` was a path segment under the hand-rolled router; the TanStack migration
made it a *search param* on `/` and two callers were never updated. TanStack's
`defaultNotFoundComponent` is literally `<p>Not Found</p>` and logs nothing, so
the first thing a new learner ever clicked put them on two unstyled words with
an empty console.

Three rules came out of it:

- **`<Link to>` for every route.** The target is checked against
  `routeTree.gen.ts`, so the same mistake is now a compile error that lists every
  valid path. A string in an `href` is just a string. This is the whole fix —
  the rest is damage limitation.
- **An in-page anchor must not write the hash.** `href="#curriculum"` makes the
  router read `curriculum` as a *path*, match nothing, and render not-found over
  the section it just scrolled to. Use `scrollToSection()` from `motion.ts` from
  an `onClick` with `preventDefault()`, keeping the `href` for focusability. The
  skip link additionally needs `{ focus: true }` — scrolling the view while
  leaving focus in the header has not skipped anything.
- **`NotFound` is registered as `defaultNotFoundComponent`** and names the
  unmatched path both on screen and in `console.error`. Never leave the default
  in place; a dead end that logs nothing costs an entire debugging session.

`useRoute.ts`'s `go()` still writes the hash directly — it is the pre-migration
shim, it is spelled correctly now, and its remaining callers (`Study`,
`LessonQuiz`) should migrate to `useNavigate`. Do not add new ones.

## The shell and the dashboard (2026-08-05)

`__root.tsx` mounts `<AppShell>` around every route: a full-height sidebar, a
sticky header, the routed screen, a footer. Two consequences to know before
touching it.

**`/` is the dashboard when signed in and the shop window when signed out.**
The catalog that used to be the bottom two-thirds of `/` is now `/courses`, and
**`?learn=` moved with it** — `/` declares no search params, so a `learn` left
on the home route is dropped silently. Its writers are the dashboard's Continue
card and the end of a lesson; both point at `/courses`. This is the same class
of defect as the `#/learn/<id>` button, so a third writer points there too.

**The sidebar's collapsed state lives in `AppShell` and must stay there.** It is
one boolean meaning "rail" on a desktop and "out of the way" on a phone. A shell
that remounted on navigation would spring the menu open every time a learner
opened a lesson, which is the reason the shell is in `__root` rather than being
a per-route layout.

### The design has features this API cannot answer, and they are absent

`platform-dashboard-layout.jpg` in the repo root is the reference. It draws
several things the server has no data for, and each was dropped rather than
filled with a plausible number — the reward layer's rule ("never render a figure
the server did not send") applied to a whole screen. Do not re-add them without
the endpoint that makes them true:

- **Study time (45 / 60 min)** — nothing records session duration.
- **Per-activity daily targets** (Reviews 32 / 40, Lessons 2 / 3) — only
  `daily.goalXp` exists. Those rows are counts, not fractions.
- **"Upcoming reviews — due in 15m"** — `/reviews/due` is `due: { $lte: now }`.
  There is no forward schedule on the wire, so the panel shows what is *ready*
  and how long it has waited.
- **Global rank #3,247** — there is no global ranking. `/social/leaderboard` is
  a weekly league bracket, so the tile names the tier and says which rank it is.
- **Notification bell, Upgrade to Premium** — no notifications API, no billing.
- **Month navigation on the calendar** — `streakDays` + `lastStudyDate` prove
  exactly one unbroken run. Paging back would render empty squares, and an empty
  square in a calendar is read as "nothing happened that day" — a false claim
  about the learner's own history rather than an absence of data.
- **Curated "Recommended for You" tiles and their cover art** — no
  recommendation endpoint and no lesson artwork. The row is the next unlearned
  lessons in teaching order, which is derivable and is a real answer.
- **The padlocked path node** — `GET /lessons` is public and the curriculum
  renders every row, so a lock here would be a rule the product does not have
  and a learner could disprove by clicking.

**Dates are `'YYYY-MM-DD'` strings in the *account* timezone, never `Date`
comparisons.** `days.ts` mirrors `api/src/user/gamification/streak.ts` for the
reason that file gives: a day is a calendar concept, and comparing instants
breaks a streak at exactly the wrong moment. The split is that the header's
*greeting* reads the browser clock — it describes where the learner is sitting —
while anything the server counts reads `settings.tz`.

## The browse surfaces, and what unlocked them (2026-08-05)

Nine of the sidebar's twenty-five rows were `planned`; eight still are. What
unlocked the rest was mostly **finding endpoints nothing was reading**, not
writing new ones:

- `/hiragana`, `/katakana` — `GET /lessons/curriculum`, public, one request,
  208 characters. `KanaLibrary` backs both.
- `/progress` — `GET /learning/memory-model` and `GET /learning/analytics`.
  Neither had ever been called from this site.
- `/achievements` — `gamification.ts`, and it re-homes `Achievements.tsx`, which
  the dashboard orphaned.
- `/settings` — `PATCH /me/settings`. The only screen here that writes.
- `/vocabulary`, `/kanji`, `/grammar`, `/dictionary` — `GET /units/:unit/content`,
  **the one API addition**, and it is a controller over
  `ContentService.findUnitContent`, which already existed and was already used
  by the checkpoint. Two queries per unit; the alternative was 32 lesson fetches
  for `vocab-n5` alone.

**`useCorpus` is one cache entry shared by four screens.** It fans out over
every unit, dedupes by `(kind, id)` *across* units as well as within them, and
`allSettled`s so one dead unit degrades the library rather than emptying it.
Measured today: 11 units, 1126 unique items — 802 vocab, 208 kana, 104 kanji,
12 grammar. Do not give the four screens their own fetches.

Lists are capped at `RENDER_CAP` (120) with the match count shown beside it.
802 vocabulary rows is ~4000 DOM nodes and a search field that stutters on every
keystroke; a cap plus an honest count is the dependency-free version of
virtualisation, and a truncated list that says it is truncated is not a lie.

### Two content gaps that make shipped features inert

Both were found by building on top of them, and neither is a code defect:

- **`/content/strokes/:codepoint` 404s for every character** — あ, ア and 日 all
  tried. Nothing is seeded. `StrokeOrder` renders `null` by design when it has
  no data, so this is silent: the Study screen's stroke diagram and
  `TraceCanvas` — "the one graded thing on the study screen" — have had no
  target for their whole life.
- **`taughtInLesson` is `null` for all 208 kana.** The attribution migration has
  not run. `KanaLibrary` omits the field rather than printing "unknown" 208
  times.

The remaining eight locked rows and what each needs are documented in
`constants/navigation/sidebar.ts`. Keep that list current — it is the only
place the reasons live.

## `/courses` is the course page (2026-08-05)

Built from `UI/course-ui.png`. **That mock is black and gold; this is not.** The
palette stays the dashboard's violet/pink on slate, because the two screens sit
one click apart behind the same sidebar and a course page in a different scheme
reads as a different product. Only the structure was taken: banner, progress
dial, module accordion, right rail, feature strip. `course.css` contains no
colour literals, which is what makes that a property of the file rather than a
promise in a comment.

**There is one course, so `/courses` *is* it.** The design has "← Back to
Courses" above a detail page; a list of one card with a back link to it is
ceremony. If a second track lands — the API already models
`profile.activeTrack` — the list becomes worth building and this becomes
`/courses/$track`.

**Modules are units.** The design shows eight; there are eleven, from
`groupByUnit` in teaching order with their `UNIT_LABELS` blurbs. The percentage
on each is completed lessons over total, counted from `completedLessonIds`.

`Curriculum.tsx` is gone. `LessonRow` **moved** out of it into
`components/course/` unchanged — lazy detail fetch on open, the imperative
`?learn=` open-and-scroll, prerequisite locking, and the learn/practise/skip
actions are all still there and all still load-bearing. It was a move rather
than a copy on purpose: two near-identical lesson rows is how `.btn` and
`.button` came to disagree about `:disabled`.

**The module holding `?learn=` must be open before its lesson row mounts** —
`scrollIntoView` on an element inside a closed `<details>` does nothing. That is
why the open set is computed in the `useState` initialiser rather than in an
effect, and why the follow-up effect depends on the resolved *slug* rather than
on `units` (which is rebuilt every render, so depending on it re-ran the effect
and its setState on every single render).

### Dropped from the design, for the usual reason

Ratings and the Reviews/Q&A tabs (no reviews API), durations — "25h 30m", "18
min" — (nothing records or estimates lesson length; `itemCount` takes the slot),
the named instructor (no instructor model), course statistics like "24,531
students enrolled" (no aggregate endpoint — the panel shows *your* figures and
is titled accordingly), certificate/lifetime access/Go Premium (no
entitlements), bookmarking (nowhere to persist it), and related JLPT N4/N3
courses (they do not exist; every levelled item in the corpus is N5).

With Reviews, Q&A and Resources gone the tab bar would be "Overview" — the page
you are on — and "Curriculum" — the section below it. That is chrome pretending
to be navigation, so the tabs went too.

## Tracing: `debug.ts`

Console tracing for the flows that fail *silently* — a route miss, a fetch that
resolves non-2xx, an effect that decides to do nothing. None of those throw, and
all of them look identical from the outside: a screen that did not change.

`log(channel, message, data?)` is gated; `logError(channel, …)` is **not**,
because a dead end has to be visible to whoever already has the console open
without them first knowing a flag exists. Channels are `nav`, `api`, `auth`,
`route`, `ui`, `quiz` — prefixed on every line so the console filter box works.

On automatically under `npm run dev`. In a production build it is off by default
and **switchable at runtime**, which is the part that matters: the bug above was
reported against the deployed site, where a dev-only logger would have been no
use.

```js
__langapp.debug.on()   // or localStorage['langapp:debug'] = '1', or #debug in the URL
```

Instrumented at the choke points rather than sprinkled: `send()` in `api.ts`
covers all ~40 endpoints, `router.subscribe('onResolved')` in `main.tsx` covers
every navigation, and `useSession` logs on *transition* (module-scoped, so N
components calling the hook do not produce N lines for one change).

## A className with no rule is invisible to every check we run

`tsc`, `oxlint` and `vite build` were all green while ~40 classes were being
applied to elements with no rules behind them — a class attribute is just a
string, so nothing validates it. `StrokeOrder` was the worst case: without
`.stroke-draw`'s dash pair the strokes rendered solid and simultaneously, so
the component that exists to animate stroke order silently drew a finished
glyph (OPEN-ITEMS #40).

The audit is a diff of every `className` in the `.tsx` sources against every
selector in the stylesheets, with two wrinkles: a token containing `${` is a
dynamic prefix and should be matched against rule *prefixes*, and expression
fragments leak into a naive regex and need filtering. Same shape of check works
for `var(--token)` references, which is how three undefined tokens turned up —
two with no fallback, so the declaration dropped outright.

**Write the rule in the same commit as the class.** Nothing downstream will
tell you that you forgot.

Two things about editing `app.css`, both learned by breaking the build:

- **A CSS comment cannot contain `*/`.** A glob written out in prose closes the
  comment early, and lightningcss then reports a pseudo-element error pointing
  at a line well below the real cause.
- **No backticks in comments** — lightningcss tokenises them and fails.

## Commands

```bash
npm run dev         # vite dev server
npm run typecheck   # tsc -b --noEmit
npm run build       # vite build && tsc -b — the real gate
npm run lint        # oxlint
```

There is no test runner. `typecheck` and a successful `build` are the gate, as
in `client/`.

**`vite build` runs first, and the order is load-bearing.** `src/routeTree.gen.ts`
is generated by the TanStack Router plugin and is gitignored — the plugin owns it,
so it exists on any machine that has run `dev` or `build` and on no machine that
has only ever cloned. `tsc` cannot generate it, so `tsc -b && vite build` type-checks
against a module that is not there yet and fails with `TS2307: Cannot find module
'./routeTree.gen'` plus a cascade of `createFileRoute` errors — but *only* on a
clean checkout, which is why it passes locally and breaks the deploy. It did exactly
that on 2026-07-29 and took `/learn` down with a 502.

Consequence to know: `dist/` is written before the type-check, so a build that fails
types still leaves a fresh bundle on disk. `npm run build` still exits non-zero and
the deploy script still refuses to restart the service, so nothing ships — but do not
treat the presence of `dist/` as evidence a build passed.

For the same reason `npm run typecheck` alone fails on a fresh clone. Run `npm run
build` first, or `npx vite build`, to materialise the route tree.

## Working style

- One milestone at a time. Stop and report after each.
- Don't add dependencies without asking.
- Boring, obvious code. This is solo-maintained.
