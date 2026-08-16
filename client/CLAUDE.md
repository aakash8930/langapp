# Project rules — GENKŌ client

React Native + Expo client for the shared GENKŌ API.
The API is already built and live; this repo only consumes it.

## Stack (do not substitute without asking)

- **Expo** (latest stable SDK) + **TypeScript** strict mode
- **expo-router** for file-based navigation
- **@tanstack/react-query** for all server state — no manual `useEffect` fetching
- **expo-secure-store** for auth tokens (**never** AsyncStorage for tokens)
- **react-native-reanimated** for animation
- **expo-haptics** for grade feedback
- **@expo-google-fonts/zen-kaku-gothic-new** for Japanese text

No component library (no NativeBase, no Tamagui, no Paper). Styling is a local theme
module — this app has a specific visual identity that generic components would erase.

## API

Base URL from `EXPO_PUBLIC_API_URL`. Never hardcode it.

Endpoints available:

```
POST /auth/register  POST /auth/login  POST /auth/refresh
GET  /me             PATCH /me/settings   GET /me/progress
GET  /lessons[?unit=]  GET /lessons/:id
GET  /lessons/:id/exercises
POST /lessons/:id/exercises/:exerciseId/answer
POST /lessons/:id/complete
GET  /reviews/due    POST /reviews/:cardId/grade
POST /chat/sessions  POST /chat/sessions/:id/messages
POST /units/:unit/checkpoint
POST /units/:unit/checkpoint/:attempt/answer/:exerciseId
POST /units/:unit/checkpoint/:attempt/submit
```

**The home screen fetches every unit in one request** (`fetchLessons()` with no
argument) rather than one query per unit. Lock state is derived from the whole
set, so a katakana lesson locked behind a hiragana one can name the lesson that
opens it — asking per unit leaves that prerequisite unresolvable and the row
says nothing. Unit display names and teaching order live in `lib/lessons.ts`,
because the alternative is a units endpoint to serve two rows of static text.

**Chat has no history endpoint** — those two routes are all there is. React
Query's cache under `['chat','session']` is therefore not a cache of server
state, it *is* the transcript store: `gcTime: Infinity`, and every append goes
through `setQueryData`. Writing the transcript to component state instead would
lose an in-flight turn the moment someone navigates home mid-reply.

A chat send is a real LLM call — seconds, not milliseconds. Sends are
serialised (composer disabled while one is in flight), so the concurrent-
mutation trap below cannot arise here. A failed turn persists **nothing**
server-side, so re-sending the same text can't duplicate it.

Chat fails in ways `describeError` gets wrong, so `lib/chat.ts` owns its copy:
**503** means the API has no `GEMINI_API_KEY` (no retry will help — the fix is
on the laptop), **502** means the model didn't answer, **429** is either this
app's throttle or the provider's quota and the copy doesn't pretend to know,
**400 "full"** means the 50-message cap and only a new session clears it.

All except register/login/refresh require a bearer token. A 401 triggers one automatic
refresh-and-retry; if that fails, clear the session and route to login.

Every request carries a **10s timeout** (`AbortController` in `api/client.ts`). Without
it a funnel that terminates TLS while the API behind it is dead makes `fetch` hang
forever. A timeout and a refused connection both surface as `OfflineError`.

`PATCH /me/settings` takes `dailyGoalXp` too, and it is stored on `gamification`, not
`settings` — see the contract in the root CLAUDE.md.

## The unit checkpoint (2026-07-29)

`app/(app)/checkpoint/[unit].tsx` is the end-of-unit test. It is **not the
lesson screen with a flag**, and each difference is one a shared screen would
have had to branch on:

- **No feedback panel.** A lesson shows the answer the moment you get one
  wrong; a test cannot, because a later question can be about the same item.
  The server enforces it — every answer comes back with `correctValue: ''` —
  so there is nothing to render even if the screen wanted to. The answers
  arrive at submit, in `missed`.
- **No audio**, not even on `vocab` prompts where the lesson plays it freely.
  A test is stricter than `hasAudio`/`revealsAnswer`. Changing that is a
  pedagogical call, not a UI one.
- **No auto-advance, no hold-to-pause, no `answerFeedback` haptic.** All three
  exist to pace a *verdict*, and there is none. The screen moves when the
  learner answers.
- **`SessionProgress` gets no `outcomes`**, so it renders a plain fill rather
  than pips. Pips carry per-question right/wrong, which this screen genuinely
  does not know — grey pips that never colour in would look broken.

Three rules that must not be re-derived here:

- **`passMark` is read off the response.** It is not `0.8` anywhere in this
  app. A client holding its own copy of the bar tells learners they passed
  when they did not.
- **`startCheckpoint` is idempotent.** It returns the *open* attempt until it
  is submitted, so remounting, backgrounding the app, or leaving and coming
  back all resume the same questions — and it cannot be used to re-roll for an
  easier draw. Do not add a guard against calling it; the guard is server-side.
- **Answers overlap, so they are plain async calls with the ledger in a ref** —
  exactly the concurrent-mutation trap in the Conventions section below. Submit
  `allSettled`s the in-flight ones first, because the server counts an
  unanswered question as wrong.

`responseTimeMs` is sent and clamped at five minutes. The server keeps a
cumulative running mean per item, so a sample from a phone that was locked
mid-question would sit in that item's average for a very long time.

The checkpoint appears at the foot of a **finished** unit's path, which means
it is behind expanding a completed chapter. Discoverable rather than pushed —
see OPEN-ITEMS #39 for the open question of whether finishing a unit's last
lesson should offer it directly.

## Design rules

Every color, font size, and spacing value comes from `theme/`. **No inline hex codes or
magic numbers in components.** Light and dark themes are both first-class — dark is not
an afterthought.

`useTheme()` reads the palette resolved by `ThemeProvider`, which reconciles the user's
stored `settings.theme` against the OS. Outside the provider it follows the OS, so the
splash and the font-loading hold still look right. `theme/themes.ts` exists only to keep
`index.ts` and `ThemeProvider.tsx` from importing each other.

**Contrast is a gate, not a preference.** Every foreground/background pair must clear
WCAG AA — 4.5:1 for body text, 3:1 for large. `shu` was darkened to `#BC3E28` for
exactly this reason, and an `opacity: 0.85` on a coloured ground failed it. Text drawn
at partial opacity really composites; check the composited value, not the token.

Loading states are **skeletons, not spinners** (`components/Skeleton.tsx`), sized from
the tokens the real components use so nothing shifts when data lands. Anything animated
checks `useReducedMotion()` and holds still — not merely animates faster.

Restraint is the house style: no gradients, no drop shadows (1px hairlines only), no
bounce or spring-overshoot animation. The review screen's grade scale is the single
place where the design is allowed to be bold.

## Copy rules

- Active voice, sentence case. Buttons say what happens: "Start review", not "Submit".
- Errors state what went wrong and what to do. Never "Something went wrong." Never apologize.
- Empty states invite an action.
- An action keeps its name through the whole flow.

## Conventions

- One screen per file under `app/`, shared UI in `components/`.
- Server state lives in React Query; only genuinely local UI state uses `useState`.
- **Never use `useMutation`'s per-call callbacks for concurrent mutations.** The
  observer keeps one slot for the options passed to `mutate()`, and each new call
  overwrites it and detaches from the previous mutation — so if a second call starts
  before the first resolves, the first's `onSuccess`/`onError` never fire. The POST
  still lands, so the server stays correct while the client silently loses the result.
  Verified against query-core: three rapid calls, one callback. Where mutations
  overlap (the review session), call the plain async function and keep the ledger in
  component state. Hook-level `onSuccess` is safe; per-call is not.
- Every list has an explicit loading, empty, and error state before it's considered done.
- Whole-screen failures use `components/ErrorState.tsx`; inline one-liners use
  `FormError`. Copy comes from `lib/errors.ts`, which owns the offline wording — the
  laptop being asleep must never read like a crash.
- Interactive elements carry an `accessibilityLabel` even when they have a visible text
  child, if that child can be swapped out (a `Button` shows a spinner while loading and
  would otherwise go nameless). Touch targets clear 44pt — a bare line of link text is
  ~20pt and needs padding.
- The API runs on a laptop and will be offline regularly — treat that as a normal
  condition to handle, not an exception.

## Building

`eas.json` defines three profiles; all three build an **APK** (`android.buildType`),
never an AAB. EAS defaults `production` to `app-bundle`, so that override is deliberate
— this app is sideloaded and an AAB cannot be installed directly.

**`EXPO_PUBLIC_API_URL` lives in `eas.json`, not `.env`.** `.env` is gitignored and EAS
uploads the committed git state, so a build relying on `.env` gets an undefined base URL
and throws on first launch. Keep the value in all three profiles in step.

`app.json` is managed-workflow — there is no `android/` directory and there should not
be. `npx expo prebuild` is fine for *checking* what the config generates, but delete
`android/` afterwards: if it exists, EAS stops prebuilding and uses it instead. Prebuild
also rewrites the `android`/`ios` npm scripts to `expo run:*`; revert those.

Splash and adaptive-icon colours are duplicated from `theme/colors.ts` into `app.json`
(`#F2F1EC` light, `#141310` dark) because the native launch screen renders before any JS
runs. They have to be updated in both places. The native splash follows the **OS** dark
setting via `values-night`, not the user's stored `settings.theme` — nothing can read a
server-side preference that early.

Prebuild warns `userInterfaceStyle: Install expo-system-ui`. Benign here: that feature is
for *forcing* a native style, and `app.json` asks for `automatic`. The generated theme is
already `Theme.AppCompat.DayNight` with `uiMode` in the activity's `configChanges`, which
is what makes `useColorScheme()` follow the system and update live.

## What NOT to build

No AR/camera, no second language, no in-app purchases. (The remaining Phase 0
items — voice/audio *recording*, offline lesson caching, social features — are
addressed by `PHASE-2-BLUEPRINT.md`; see "Phase 2" below.) If a task appears
to need one of these, stop and ask.

## Phase 2

`PHASE-2-BLUEPRINT.md` landed 2026-07-27. Three things in this Phase 0 list
have been reclassified — they are in scope now, in the form the blueprint
spells out, not in the form the Phase 0 boundary forbade:

- **Social features** — already shipped 2026-07-26 (chat, friends, DMs,
  blocking, reporting, weekly leaderboard). The Phase 0 entry above is stale;
  treat social as a built surface.
- **Offline lesson caching** — §6.3, Stage 1+. Not started yet; the surface is
  in scope, the implementation is not. Stop and ask if a task seems to need
  offline lessons *before* Stage 1 lands.
- **Voice / audio** — the recording side (microphone, STT, pronunciation
  scoring) is gated by §3.3: it is *premium-metered*, not free. Playback
  (TTS, the audio route already shipped for kana and vocab) is not gated.
  Building the gated half needs the §6.8 design and the §3.3 reconciliation
  in the root CLAUDE.md read together; do not start without both.

Three things that *are* still forbidden: AR/camera, a second language, and
in-app purchases. AR remains out — there is no roadmap for it. The second
language is gated on the first one being finished, and that is not yet true.
In-app purchases would require Razorpay wiring and a store listing, neither of
which exists.

Hearts and gems are gone (Phase 2 §3.1). Leagues are promotion-only and
opt-in (§3.2). Both are committed on `phase-2-foundations`; do not reintroduce
either.

## Working style

- One milestone at a time. Stop and report after each.
- Don't add dependencies without asking.
- Boring, obvious code. This is a solo-maintained repo.
