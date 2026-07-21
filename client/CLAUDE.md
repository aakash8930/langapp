# Project rules — langapp client

React Native + Expo client for the langapp Phase 0 API.
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
GET  /lessons?unit=  GET  /lessons/:id
GET  /lessons/:id/exercises
POST /lessons/:id/exercises/:exerciseId/answer
POST /lessons/:id/complete
GET  /reviews/due    POST /reviews/:cardId/grade
POST /chat/sessions  POST /chat/sessions/:id/messages
```

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

No voice/audio recording, no AR/camera, no offline lesson caching, no social features,
no second language, no in-app purchases. If a task seems to need one, stop and ask.

## Working style

- One milestone at a time. Stop and report after each.
- Don't add dependencies without asking.
- Boring, obvious code. This is a solo-maintained repo.
