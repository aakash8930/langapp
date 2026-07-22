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
unauthenticated. Everything that *teaches* — quizzes, completion, progress — is
behind a bearer token.

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

## Commands

```bash
npm run dev         # vite dev server
npm run typecheck   # tsc -b --noEmit
npm run build       # tsc -b && vite build — the real gate
npm run lint        # oxlint
```

There is no test runner. `typecheck` and a successful `build` are the gate, as
in `client/`.

## Working style

- One milestone at a time. Stop and report after each.
- Don't add dependencies without asking.
- Boring, obvious code. This is solo-maintained.
