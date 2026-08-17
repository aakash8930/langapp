# GENKŌ — MVP readiness audit & UX remediation

**Audited:** 2026-08-17
**Branch:** `arena/01a00efe-langapp` (from `e56da14`)

Two questions are answered here: (1) *is the code ready for MVP?*, and (2)
*what changed in response to learner testing that reported the UI as too
complex and the fonts as too small.*

---

## Verdict

**Code complete and quality-gated: YES.** Every automated gate — typecheck,
lint, unit tests, production build, entry budget, and dependency audit —
passes on all three apps (evidence below).

**Ready to announce publicly: NOT YET.** The blockers are *operational*, not
code. Every required row in `RELEASE-CHECKLIST.md` (infrastructure isolation,
public preflight from an external network, real-account acceptance, mail
smoke, verified off-site backup/restore, Android device acceptance) is still
blank. Those gates cannot be discharged in this sandbox — they require the
isolated production deployment, mail credentials, and a physical device. A
green build proves the code assembles; it does not prove mail arrives or a
backup restores.

---

## Quality-gate evidence (run this session, 2026-08-17)

| App | Gate | Result |
|---|---|---|
| `api` | `npm run typecheck` | clean |
| `api` | `npm test` | **68 suites / 3,516 tests passed** |
| `api` | `npm run audit:prod` | 0 vulnerabilities |
| `web` | `npm run lint` | 0 warnings, 0 errors |
| `web` | `npm run typecheck` | clean |
| `web` | `npm run build` | passed; entry budget 379.9 KiB JS / 38.9 KiB CSS / 131.4 KiB gzip |
| `web` | `npm run audit:prod` | 0 vulnerabilities |
| `client` | `npm run typecheck` | clean |
| `client` | `npm test` | 2/2 passed |
| `client` | `npm run audit:prod` | only the 3 reviewed Expo build-tool advisories allowed |

The Playwright journey (`web/e2e/account-first-run.spec.ts`) could not be run
here: the sandbox blocks the browser download (`npx playwright install
chromium` fails on network policy). The test does not assert on any dashboard
widget, so the dashboard change below does not affect it; it should still be
run in CI before release.

---

## UX remediation

### 1. Fonts were too small — fixed systemically

The complaint was real and worse than the token scale suggested. Two separate
problems existed:

1. **A small base scale.** The web tokens were 12px caption / 14px small /
   16px body; the client was identical.
2. **Hundreds of hardcoded sizes that bypassed the tokens entirely** —
   `font-size: 0.54rem` (≈8.6px), `0.58rem`, `0.65rem`, etc., across every
   learner-facing stylesheet. A sweep counted **596** such declarations below
   14px.

Changes:

- **Web token scale** (`web/src/theme.css`): caption 12→14px, small 14→16px,
  body 16→18px, large 18→20px, title 24→26px, heading 32→36px, display
  floor raised.
- **Client scale** (`client/theme/typography.ts`): caption 12→14, small
  14→16, body 16→18, bodyLarge 18→20, title 22→24, heading 28→32, with
  line-heights re-paired. The large exercise-glyph sizes (kana 72, kanji 56,
  streak 64) are unchanged.
- **Hardcoded floor.** Every web `font-size` below 0.875rem was raised to
  0.875rem (14px), and every `px` value below 14px raised to 14px. The single
  exception is the header notification count badge, restored to 12px because a
  20px circle cannot hold 14px numerals.
- **Client hardcodes** (`_layout.tsx` tab label, `verify-email.tsx` eyebrow)
  raised 12→14px.

Hierarchy is preserved: the whole scale moved together rather than flattening.

### 2. Dashboard was too complex — reduced to one essential path

The signed-in dashboard composed **12+ widgets** (quick actions, continue
learning, practice by skill, AI recommendations, recent lessons, badges,
community feed, streak, today's goal, JLPT panel, a free-access card, and a
footer strip).

It is now **three blocks**:

1. **Continue learning** — the single "what do I do next" answer.
2. **Progress** — streak + today's goal, side by side.
3. **Practice by skill** — reading, listening, speaking, writing.

Everything removed is still reachable from the sidebar; it simply no longer
competes with the primary path on the home screen. The layout collapses from
a two-column (main + side) grid to one readable column.

Fourteen now-unused widget components were deleted
(`QuickActionsRow`, `AIRecommendations`, `BadgesCard`, `CommunityFeed`,
`JLPTPanel`, `UpgradePremium`, `DashboardFooter`, plus seven already-orphaned
files: `Announcements`, `CalendarCard`, `LevelCard`, `NotificationBell`,
`PathCard`, `ProverbCard`, `RecentLessons`).

### 3. Mobile already lean — no structural change

The Expo client was already the focused product (Today / Learn / Practice /
Profile). It received the global font bump and the two hardcoded-size fixes
only; no features were removed.

---

## Remaining follow-ups (not blockers for code review, tracked)

- **Dead CSS.** Orphaned rules for the removed widgets remain in
  `web/src/components/dashboard/dashboard.css`. They render nothing and are
  not flagged by lint/build; a tidy pass can delete them later.
- **Navigation breadth.** The signed-in sidebar still lists ~27 destinations.
  They are all working routes (the last commit removed the inert "planned"
  rows), but it is worth a separate pass to collapse them into fewer groups
  now that the dashboard carries the primary path.
- **Operational release gates.** Complete `RELEASE-CHECKLIST.md` sections 1–6
  against the production deployment before announcing availability.
