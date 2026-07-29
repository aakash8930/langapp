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
- No component library, no CSS framework, no state manager, **no router** —
  `useRoute.ts` is a thirty-line hash router. Hash-based on purpose: it needs no
  server rewrite rule, so the build is plain static files that work from any
  directory on any host, which matters while deployment is still open.

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
