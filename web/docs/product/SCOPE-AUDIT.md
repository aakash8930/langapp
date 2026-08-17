# GENKŌ — Scope Audit (v2.0 / 2026-07-31)

This file maps a generic 31-section product sitemap onto the **actual** state of
the langapp repo. It is not a roadmap. Items that have no route in `api/`, no
screen in `client/` or `web/`, and no milestone in the blueprints are tagged
`⬜ backlog`, not silently absorbed.

## Legend

| Tag | Meaning |
|---|---|
| ✅ | **Shipped** — code is live in `api/`, `client/`, or `web/`. Route or path cited. |
| 🟡 | **Planned** — named in `PHASE-0-BLUEPRINT.md`, `PHASE-2-BLUEPRINT.md`, or an in-flight blueprint slice. |
| ⬜ | **Backlog** — not on any blueprint. Decoupled from the product, no work scheduled. |
| ❌ | **Out of scope** — explicit Phase 0 boundary (`api/CLAUDE.md`, `client/CLAUDE.md` §"What NOT to build") or removed. Rejection reason cited. |

## Source of truth

- **API contract:** `api/src/**/*.controller.ts` (controllers listed in
  `web/docs/architecture/`). All `✅` API entries cite a route.
- **Web routes:** `web/src/routes/*.tsx` (10 files). All `✅` web entries cite a path.
- **Client routes:** `client/app/(app)/**` (Expo Router; the screen list lives in
  `client/CLAUDE.md` §"API" and §"The unit checkpoint").
- **Phase 0 boundaries:** `api/CLAUDE.md` §"What NOT to build" and
  `client/CLAUDE.md` §"What NOT to build". These are the source for `❌` items.
- **Phase 2 carve-outs:** `api/CLAUDE.md` and `client/CLAUDE.md` §"Phase 2".
  These reclassify two Phase 0 "no" items into "premium-metered" or "job runner
  only" without reopening the rest.

## Working-set caveats

- `web/docs/product/FEATURES.md` is **empty** as of 2026-07-31. This file
  intentionally does not duplicate it — when FEATURES is filled, link the two.
- `web/src/components/ai/`, `dashboard/`, `learning/`, `review/` are **empty
  directories**. Sub-component slots are reserved but not built; the parent
  components in `web/src/components/` (e.g. `Review.tsx`, `LessonQuiz.tsx`,
  `CheckpointQuiz.tsx`) carry the load alone.
- The web product is the marketing + light-shell side; the *learner* surface
  lives in `client/`. Where a sitemap entry maps to a learner screen, the
  citation points at `client/`, not `web/`.

---

## 0 · Public Website (Web)

The web is a single page (`/`) with anchor-linked sections and a footer. There
is no separate `Landing`, `About`, `Pricing`, `Blog`, etc. — these are
conventional SaaS sections this product does not have.

| Item | Tag | Note |
|---|---|---|
| Landing Page | ✅ | `web/src/routes/index.tsx` — single page composes Hero, Continue, Curriculum, Achievements, footer. |
| About | ❌ | No blueprint; no section in `web/src/routes/index.tsx`. |
| Features | ❌ | The home page's `<Curriculum>` lists *what you can learn*; there is no product-features marketing section. |
| Pricing | ❌ | Phase 0 has no paid tier. `❌` per Phase 0 boundary (no in-app purchases, no payments wiring). |
| Schools / Enterprise | ❌ | No B2B surface in any blueprint. |
| JLPT Preparation | ⬜ | Backlog. The JLPT taxonomy appears in lesson tags but no prep surface is built. |
| Success Stories | ❌ | No content surface; no blueprint. |
| Testimonials | ❌ | No content surface. |
| Reviews | ❌ | No content surface. |
| Blog | ❌ | No CMS, no blueprint. |
| Documentation | ⬜ | `web/docs/` exists for internal architecture; no user-facing docs site is planned. |
| Roadmap | 🟡 | `web/docs/product/ROADMAP.md` is the internal roadmap. Not a public page. |
| FAQ | ❌ | No blueprint. |
| Contact | ❌ | No blueprint. |
| Careers | ❌ | No blueprint. |
| Press Kit | ❌ | No blueprint. |
| Privacy Policy | ✅ | `api/src/legal/legal.controller.ts` → `GET /legal/privacy` (HTML). |
| Terms of Service | ✅ | `api/src/legal/legal.controller.ts` → `GET /legal/terms` (HTML). |
| Cookies | ❌ | No cookie banner, no banner blueprint. |
| Refund Policy | ❌ | No paid tier; nothing to refund. |
| Community | ❌ | "Community" exists as social features (see §23) but not as a public marketing surface. |
| Affiliates | ❌ | No blueprint. |
| Gift Plans | ❌ | No paid tier; no blueprint. |
| Referral Program | ❌ | No blueprint. |
| Status Page | ❌ | No blueprint. |
| Changelog | ⬜ | `web/docs/product/CHANGELOG.md` exists internally; not a public page. |

---

## 1 · Authentication

Auth endpoints live in `api/src/auth/auth.controller.ts`. The web has no auth
pages — auth is a modal on `/` (`SignIn.tsx`) and a route on the client
(`client/app/(auth)/`).

| Item | Tag | Note |
|---|---|---|
| Welcome | ⬜ | Not on the web. Client opens at the curriculum; no welcome screen. |
| Sign Up | ✅ | `POST /auth/register`. UI: `web/src/components/SignIn.tsx` (modal), `client/app/(auth)/`. |
| Login | ✅ | `POST /auth/login`. Same UI surface. |
| Continue with Google | ❌ | No OAuth provider wired. `client/CLAUDE.md` forbids adding deps without asking. |
| Continue with Apple | ❌ | Same. |
| Continue with GitHub | ❌ | Same. |
| Forgot Password | ✅ | `POST /auth/forgot-password` (route exists; client surface not verified — flag for client milestone). |
| Reset Password | ✅ | `POST /auth/reset-password`. |
| Verify Email | ❌ | `auth.controller.ts` has no `verify-email` route; no blueprint. |
| Resend Verification | ❌ | Same. |
| Two-Factor Authentication | ❌ | Phase 0 boundary: no 2FA. `client/CLAUDE.md` §"What NOT to build" lists SAML/SSO prohibitions. |
| Backup Codes | ❌ | Depends on 2FA. |
| Device Management | ❌ | No blueprint. |
| Delete Account Confirmation | ✅ | `api/src/user/account-deletion.controller.ts` → `DELETE /me`. Client confirmation surface lives in `client/app/(app)/settings`. |

---

## 2 · First-Time Onboarding

The client has no separate onboarding flow. After register, the user lands on
the curriculum, which is gated by `dailyGoalXp` on the gamification collection
and read in `PATCH /me/settings`.

| Item | Tag | Note |
|---|---|---|
| Welcome | ⬜ | Not a screen. |
| Language Selection | ❌ | Phase 0 = Japanese only (`api/CLAUDE.md` "Phase 0 = Japanese only, single learner flow"). Second language is explicitly forbidden. |
| Native Language | ❌ | No i18n framework (`api/CLAUDE.md` §"What NOT to build"). |
| Japanese Level | 🟡 | `client/CLAUDE.md` mentions a placement test in roadmap-shaped text; not built. |
| Goals | ⬜ | Not a screen. |
| Daily Goal | ✅ | `PATCH /me/settings` takes `dailyGoalXp`; stored on `gamification` (not `settings`); surfaced in the home page's Continue card. |
| Learning Style | ❌ | No blueprint. |
| Study Time | ❌ | No blueprint. |
| Placement Test | 🟡 | Named in client docs as an open question. Not built. |
| Notifications | ❌ | No push wiring. See §24. |
| AI Personalization | ❌ | No blueprint slice. |
| Complete Setup | ❌ | No "setup" screen exists — register is the gate. |

---

## 3 · Dashboard (Home)

Web home is the marketing + light-shell page. Learner dashboard lives on the
client. Most of this section maps to the client, not the web.

| Item | Tag | Note |
|---|---|---|
| Dashboard | ✅ | `web/src/routes/index.tsx` (web); `client/app/(app)/` (client). |
| Continue Learning | ✅ | `web/src/components/Continue.tsx` (web); same on client. |
| Today's Progress | ✅ | Derived from `session.progress` and `cardsDueNow`. |
| Daily Streak | ✅ | `api/src/gamification/` exposes streak via `me` controller. |
| XP | ✅ | Same. Surfaced in `Achievements.tsx`. |
| Achievements | ✅ | `web/src/components/Achievements.tsx`. |
| Calendar | ❌ | No blueprint. |
| Quick Actions | ⬜ | Not a built surface; the home page has the "Cards are due" callout and Continue card, not a Quick Actions block. |
| Recent Lessons | ✅ | Continue card lists last-touched. |
| Upcoming Reviews | ✅ | `cardsDueNow` from `me`; the home page's due callout. |
| Announcements | ❌ | No blueprint. |

---

## 4 · Courses

| Item | Tag | Note |
|---|---|---|
| Course Library | ✅ | `web/src/components/Curriculum.tsx` is the unit + lesson catalog. |
| Course Details | ✅ | `web/src/routes/lesson.$id.tsx` is the lesson view. |
| Learning Path | ✅ | The path is the unit order in `groupByUnit`; unit display names live in `client/lib/lessons.ts` per `client/CLAUDE.md` §"API". |
| Units | ✅ | Same. |
| Lessons | ✅ | `GET /lessons[?unit=]`, `GET /lessons/:id`. |
| Lesson Overview | ✅ | Lesson card in Curriculum. |
| Lesson Completion | ✅ | `POST /lessons/:id/complete`. |
| Course Progress | ✅ | `GET /me/progress`. |
| Certificates | ❌ | No blueprint. |

---

## 5 · Hiragana

Hiragana is the first unit in the seed. Lessons are content; no separate
Hiragana surface.

| Item | Tag | Note |
|---|---|---|
| Learn | ✅ | Seeded as lessons; the first unit. |
| Writing Practice | ✅ | `web/src/components/TraceCanvas.tsx` + `StrokeOrder.tsx`. |
| Tracing | ✅ | Same. |
| Reading | ✅ | Lesson items cover reading. |
| Listening | ✅ | `api/src/content/audio.controller.ts` → `GET /content/kana/:id/audio`. |
| Quiz | ✅ | `web/src/components/LessonQuiz.tsx`. |
| Flashcards | ✅ | `web/src/components/Review.tsx` is the SRS surface; cards cover kana. |
| Mistakes | 🟡 | `web/src/components/LessonQuiz.tsx` shows per-item feedback; "Mistakes" as a curated list is not built. |
| Spaced review | ❌ Removed | Removed from web, mobile, and API on 2026-08-17 after learner testing. Lessons, practice, and checkpoints remain. |

---

## 6 · Katakana

Same shape as Hiragana. Tagged identically.

| Item | Tag | Note |
|---|---|---|
| Learn | ✅ | Second unit in seed. |
| Writing Practice | ✅ | `TraceCanvas` + `StrokeOrder`. |
| Tracing | ✅ | Same. |
| Reading | ✅ | Lesson items. |
| Listening | ✅ | Kana audio route. |
| Quiz | ✅ | `LessonQuiz`. |
| Flashcards | ✅ | `Review`. |
| Mistakes | 🟡 | Same caveat as Hiragana. |
| Review | ✅ | `review` route. |

---

## 7 · Vocabulary

| Item | Tag | Note |
|---|---|---|
| Vocabulary List | ✅ | Surfaced via lessons and `GET /lessons`. |
| Word Details | ✅ | Lesson item detail. |
| Audio | ✅ | `GET /content/vocab/:id/audio`. |
| Examples | ✅ | Lesson items carry examples. |
| Synonyms | ❌ | No blueprint. |
| Antonyms | ❌ | No blueprint. |
| JLPT Tags | ✅ | Content schema tags (used in seed). |
| Bookmarks | ❌ | No blueprint. |
| Custom Lists | ❌ | No blueprint. |
| Practice | ✅ | `web/src/routes/practice.tsx`. |
| Review | ✅ | `web/src/routes/review.tsx`. |
| Import | ❌ | No blueprint. |
| Export | ❌ | No blueprint. |

---

## 8 · Kanji

| Item | Tag | Note |
|---|---|---|
| Kanji List | ✅ | Kanji items in lessons. |
| Kanji Details | ✅ | `api/src/content/strokes.controller.ts` → `GET /content/strokes/:codepoint` (JSON). |
| Stroke Order | ✅ | `web/src/components/StrokeOrder.tsx`. |
| Stroke Animation | ✅ | Same. |
| Radicals | 🟡 | Not a built surface; ADR-005 / `knowledgeNodes` may carry radicals as derived data. |
| Meanings | ✅ | Lesson item detail. |
| Readings | ✅ | Lesson item detail. |
| Examples | ✅ | Lesson items. |
| Writing Practice | ✅ | `TraceCanvas`. |
| Quiz | ✅ | `LessonQuiz`. |
| Review | ✅ | `review` route. |
| Bookmarks | ❌ | No blueprint. |

---

## 9 · Grammar

| Item | Tag | Note |
|---|---|---|
| Grammar List | ⬜ | Grammar exists as lesson items but no dedicated list view. |
| Grammar Detail | ✅ | Lesson item detail. |
| Examples | ✅ | Same. |
| Usage | ⬜ | Not a separate surface from Examples. |
| Common Mistakes | ❌ | No blueprint. |
| Exercises | ✅ | `web/src/components/LessonQuiz.tsx` + `CheckpointQuiz.tsx`. |
| Quiz | ✅ | Same. |
| Review | ✅ | `review` route. |

---

## 10 · Listening

| Item | Tag | Note |
|---|---|---|
| Listening Lessons | ✅ | Lessons with audio items. |
| Audio Player | ✅ | Kana + vocab audio routes. |
| Transcript | ❌ | No blueprint. |
| Translation | ❌ | No blueprint. |
| Shadowing | ❌ | Voice is forbidden in Phase 0 (`api/CLAUDE.md` §"What NOT to build" — no voice/STT/TTS). Phase 2 §3.3 keeps it premium-metered. |
| Listening Quiz | ✅ | Lesson items with audio. |
| Speed Control | ❌ | No blueprint. |

---

## 11 · Speaking

| Item | Tag | Note |
|---|---|---|
| Pronunciation | ❌ | Voice is forbidden in Phase 0; Phase 2 §3.3 keeps it premium-metered. Building it needs the §6.8 design and root `CLAUDE.md` §3.3 read together. |
| AI Conversation | ❌ | Same. |
| Speaking Challenges | ❌ | Same. |
| Voice Recording | ❌ | Microphone capture is in the same block. |
| Pronunciation Feedback | ❌ | Same. |
| Conversation History | 🟡 | The chat surface exists (`POST /chat/sessions`, `POST /chat/sessions/:id/messages`); "conversation" in the speaking sense is gated. |

---

## 12 · Reading

| Item | Tag | Note |
|---|---|---|
| Reading Library | ❌ | No reading-passage content surface. |
| Article | ❌ | No blueprint. |
| Story | ❌ | No blueprint. |
| Manga Reader | ❌ | No blueprint. |
| News | ❌ | No blueprint. |
| Dictionary Popup | ❌ | No in-app dictionary; kana/vocab are surfaced through lessons. |
| Bookmarks | ❌ | No blueprint. |
| Reading Statistics | ❌ | No blueprint. |

---

## 13 · Writing

| Item | Tag | Note |
|---|---|---|
| Writing Practice | ✅ | `TraceCanvas` + `StrokeOrder` (covers kana + kanji; Latin-script content not in Phase 0). |
| Essay | ❌ | No blueprint. |
| Sentence Builder | ❌ | No blueprint. |
| AI Feedback | 🟡 | Chat surface exists; "writing feedback" as a feature is not a built flow. |
| Corrections | ⬜ | Per-item feedback in `LessonQuiz` is the closest analog. |
| History | ❌ | No blueprint. |

---

## 14 · Flashcards

| Item | Tag | Note |
|---|---|---|
| Decks | ⬜ | Decks are an explicit concept in many SRS apps; langapp uses FSRS per-card, no deck grouping. |
| My Decks | ❌ | Same. |
| Create Deck | ❌ | No blueprint. |
| Edit Deck | ❌ | Same. |
| Shared Decks | ❌ | Same. |
| Study Session | ✅ | `web/src/routes/review.tsx`. |
| Statistics | 🟡 | `me/progress` covers aggregate stats; per-deck stats not applicable. |
| Review Queue | ✅ | `GET /reviews/due` + the review route. |

---

## 15 · Review System (FSRS / SRS)

| Item | Tag | Note |
|---|---|---|
| Today's Reviews | ✅ | `GET /reviews/due`. |
| Review Session | ✅ | `POST /reviews/:cardId/grade`. |
| Missed Reviews | ✅ | `api/src/learning/learning.controller.ts` ships `scheduleMissedWords` (per `api/CLAUDE.md` §"ADR-003 / §5.2" rule). |
| Review History | ✅ | `me/progress` covers aggregate. |
| Statistics | ✅ | Same. |
| Heatmap | ❌ | No blueprint. |
| Retention | ❌ | No blueprint. |
| Forecast | ❌ | No blueprint. |

---

## 16 · Practice

| Item | Tag | Note |
|---|---|---|
| Daily Practice | ✅ | `web/src/routes/practice.tsx`. |
| Mixed Practice | ✅ | Same. |
| Weak Areas | 🟡 | `learnerItemStates` carries per-item evidence; a "weak areas" view is not built. |
| Timed Practice | ❌ | No blueprint. |
| Random Practice | ✅ | The `Checkpoint` route mixes unit items; same surface. |
| Challenge Mode | ❌ | No blueprint. |

---

## 17 · JLPT

| Item | Tag | Note |
|---|---|---|
| JLPT Dashboard | ❌ | No blueprint. |
| N5 / N4 / N3 / N2 / N1 | ⬜ | JLPT tags exist on content; no level-gated surface. |
| Mock Tests | 🟡 | The `Checkpoint` route is the closest analog (end-of-unit test). A JLPT-level mock is not built. |
| Results | ✅ | `me/progress` + checkpoint submit return. |
| Recommendations | 🟡 | Recommendations surface is not built; the Continue card acts as one. |

---

## 18 · Exams

| Item | Tag | Note |
|---|---|---|
| Exam Library | 🟡 | Units function as the "exam library" in a thin sense; no separate exam surface. |
| Start Exam | ✅ | `POST /units/:unit/checkpoint`. |
| Instructions | ⬜ | Not a separate screen. |
| Exam | ✅ | `web/src/routes/checkpoint.$unit.tsx` + `web/src/components/CheckpointQuiz.tsx`. |
| Results | ✅ | `POST /units/:unit/checkpoint/:attempt/submit` returns `missed`. |
| Review Answers | ✅ | `missed` payload on submit. |
| Leaderboard | ✅ | `web/src/routes/leagues.tsx` + `api/src/social/social.controller.ts` → `GET /social/leaderboard`. |

---

## 19 · AI

| Item | Tag | Note |
|---|---|---|
| AI Tutor | 🟡 | Chat is built; the framing as a "tutor" surface is not. |
| AI Chat | ✅ | `api/src/chat/chat.controller.ts` (`POST /chat/sessions`, `POST /chat/sessions/:id/messages`); `web/src/components/` (chat UI to be verified). |
| Grammar Checker | ❌ | No blueprint. |
| Sentence Explainer | ❌ | No blueprint. |
| Translation | ❌ | No blueprint. |
| Conversation | 🟡 | The chat session is conversational; "conversation" as a feature (e.g. roleplay) is not. |
| Writing Feedback | 🟡 | Same — chat is the substrate. |
| Pronunciation Analysis | ❌ | Voice forbidden. |

---

## 20 · Dictionary

| Item | Tag | Note |
|---|---|---|
| Search | ❌ | No search route. |
| Word | ✅ | Lesson items + `GET /content/strokes/:codepoint`. |
| Kanji | ✅ | Same. |
| Grammar | 🟡 | Lesson items cover grammar; no standalone grammar dictionary. |
| Examples | ✅ | Lesson items. |
| Bookmarks | ❌ | No blueprint. |
| History | ❌ | No blueprint. |

---

## 21 · Progress

| Item | Tag | Note |
|---|---|---|
| Overview | ✅ | `me/progress`. |
| XP | ✅ | Same; surfaced in `Achievements.tsx`. |
| Level | ✅ | Same. |
| Daily Goal | ✅ | `PATCH /me/settings` → `dailyGoalXp` (stored on `gamification`, not `settings`). |
| Weekly Goal | ❌ | No blueprint. |
| Monthly Goal | ❌ | No blueprint. |
| Heatmap | ❌ | No blueprint. |
| Achievements | ✅ | `Achievements.tsx`. |
| Statistics | ✅ | `me/progress`. |
| Learning Analytics | 🟡 | `api/src/learning/learning.controller.ts` ships `GET /learning/analytics`; the consumer surface is thin. |

---

## 22 · Gamification

| Item | Tag | Note |
|---|---|---|
| Achievements | ✅ | `web/src/components/Achievements.tsx`. |
| Badges | ✅ | Same component covers badges. |
| Rewards | ⬜ | No rewards catalog. |
| Coins | ❌ | Hearts and gems removed (Phase 2 §3.1, per `api/CLAUDE.md` and `client/CLAUDE.md`). Coins are in the same family. |
| Leaderboard | ✅ | `web/src/routes/leagues.tsx`. |
| Challenges | ❌ | No blueprint. |
| Missions | ❌ | No blueprint. |

---

## 23 · Community

The "social" surface in langapp is friends, DMs, blocking, reporting, and
weekly leagues. There is no public community feed, forum, or events calendar.

| Item | Tag | Note |
|---|---|---|
| Feed | ❌ | No blueprint. |
| Groups | ❌ | No blueprint. |
| Forums | ❌ | No blueprint. |
| Friends | ✅ | `api/src/social/social.controller.ts` (`GET /social/friends`, friend-request routes). `web/src/components/FriendsList.tsx`. |
| Study Together | ❌ | No blueprint. |
| Messages | ✅ | `GET /social/messages/:userId`, `POST /social/messages/:userId`. `web/src/components/DirectMessages.tsx`. |
| Events | ❌ | No blueprint. |

---

## 24 · Notifications

| Item | Tag | Note |
|---|---|---|
| Notification Center | ❌ | No blueprint. |
| Reminder Settings | ❌ | No blueprint. |
| Push Notifications | ❌ | No blueprint. |
| Email Preferences | ❌ | No blueprint. |

---

## 25 · User Profile

| Item | Tag | Note |
|---|---|---|
| Profile | ✅ | `GET /me` (me.controller). |
| Edit Profile | ✅ | `PATCH /me/settings`. |
| Avatar | ❌ | No blueprint. |
| Bio | ❌ | No blueprint. |
| Certificates | ❌ | No blueprint. |
| Achievements | ✅ | `Achievements.tsx`. |
| Bookmarks | ❌ | No blueprint. |
| Learning History | ✅ | `me/progress` (coveredLessons / completedLessonIds). |

---

## 26 · Subscription

Phase 0 has no paid tier. `client/CLAUDE.md` and `api/CLAUDE.md` both list
"no in-app purchases" as a Phase 0 boundary; Phase 2 §3.3 makes voice
*premium-metered* but does not introduce a general paid tier.

| Item | Tag | Note |
|---|---|---|
| Plans | ❌ | No paid tier. |
| Upgrade | ❌ | No blueprint. |
| Checkout | ❌ | No blueprint. |
| Payment Success | ❌ | No blueprint. |
| Payment Failed | ❌ | No blueprint. |
| Invoices | ❌ | No blueprint. |
| Billing History | ❌ | No blueprint. |
| Manage Subscription | ❌ | No blueprint. |
| Cancel Subscription | ❌ | No blueprint. |
| Reactivate | ❌ | No blueprint. |

---

## 27 · Settings

| Item | Tag | Note |
|---|---|---|
| Account | ✅ | `GET /me`, `PATCH /me/settings`. |
| Security | ❌ | No blueprint (no 2FA, no device management). |
| Privacy | ❌ | No blueprint. |
| Language | ❌ | No i18n; UI English only. |
| Appearance | 🟡 | Light/dark theme is supported in `client/theme/` (per `client/CLAUDE.md` §"Design rules"). A "settings" surface to toggle it is not. |
| Accessibility | 🟡 | Contrast gate and reduced-motion are enforced (`client/CLAUDE.md` §"Design rules"); a user-facing accessibility panel is not. |
| Notifications | ❌ | See §24. |
| Downloads | ❌ | No blueprint. |
| Storage | ❌ | No blueprint. |
| Data Export | ❌ | No blueprint. |
| Delete Account | ✅ | `DELETE /me` (account-deletion controller). |

---

## 28 · Support

| Item | Tag | Note |
|---|---|---|
| Help Center | ❌ | No blueprint. |
| FAQ | ❌ | No blueprint. |
| Report Bug | ❌ | No blueprint. |
| Feature Request | ❌ | No blueprint. |
| Contact Support | ❌ | No blueprint. |
| Live Chat | 🟡 | The AI chat surface exists; "support chat" as a routed feature is not. |
| System Status | ❌ | No blueprint. |

---

## 29 · Admin Panel (Web)

| Item | Tag | Note |
|---|---|---|
| Dashboard | ❌ | No admin panel. Phase 0 boundary (`api/CLAUDE.md` §"What NOT to build"). |
| Users | ❌ | Same. |
| Courses | 🟡 | A creator surface exists at `web/src/routes/creator.tsx` (creator banner on the home page for `isAdmin`). It is course/lesson authoring, not admin. |
| Lessons | ✅ (creator slice) | `web/src/routes/creator.tsx` + `api/src/content/creator.controller.ts`. This is the **creator** surface (§30), not an admin panel. |
| Vocabulary | ✅ (creator slice) | `POST /content/creator/vocab`. |
| Kanji | ❌ | Not in creator routes. |
| Grammar | ❌ | Not in creator routes. |
| Media | ❌ | No blueprint. |
| AI | ❌ | No blueprint. |
| Reports | 🟡 | `api/src/content/content-report.controller.ts` has a `POST /content/report` route (learner-side content report, not an admin queue). |
| Payments | ❌ | No paid tier. |
| Coupons | ❌ | No paid tier. |
| Subscriptions | ❌ | No paid tier. |
| Analytics | 🟡 | `GET /learning/analytics` exists; no admin dashboard. |
| Notifications | ❌ | No blueprint. |
| Content Approval | 🟡 | The creator surface drafts but the approval queue is not built. |
| Moderation | 🟡 | `POST /social/reports` exists; a moderation queue is not. |
| Roles | ❌ | No blueprint. |
| Permissions | ❌ | No blueprint. |
| Audit Logs | ❌ | No blueprint. |
| System Settings | ❌ | No blueprint. |

---

## 30 · Creator / CMS (Web)

The creator surface is the **closest thing to a CMS** in langapp. It covers
lesson, vocab, and exercise authoring. Audio, kanji, and grammar editors are
not present; there is no draft queue, version history, or publishing flow
beyond the create endpoints.

| Item | Tag | Note |
|---|---|---|
| Course Builder | 🟡 | `POST /content/creator/lessons` ships; no full course builder UI. |
| Lesson Builder | ✅ | `POST /content/creator/lessons`. |
| Quiz Builder | ✅ | `POST /content/creator/lessons/:id/exercises` (`/lessons/:lessonId/exercises` controller, `POST` for create). |
| Kanji Editor | ❌ | No blueprint. |
| Vocabulary Editor | ✅ | `POST /content/creator/vocab`. |
| Grammar Editor | ❌ | No blueprint. |
| Audio Manager | ❌ | Audio is a file in storage; no manager surface. |
| Media Library | ❌ | No blueprint. |
| Drafts | 🟡 | The lesson row carries a status, but the draft list view is not built. |
| Publishing | 🟡 | Same. |
| Version History | ❌ | No blueprint. |

---

## 31 · Error & System Pages

| Item | Tag | Note |
|---|---|---|
| 404 | ✅ | `web/src/components/NotFound.tsx` (referenced from the route tree). |
| 500 | ❌ | No blueprint. The API throws Nest HTTP exceptions; no branded 500 page. |
| Maintenance | ❌ | No blueprint. |
| Offline | 🟡 | "Offline" is handled at the request level (`OfflineError` copy in `client/lib/errors.ts`); no branded offline page. |
| No Internet | 🟡 | Same. |
| Coming Soon | ❌ | No blueprint. |
| Empty State | ✅ | `client/components/EmptyState.tsx` is named in `client/CLAUDE.md` §"Conventions" ("Every list has an explicit loading, empty, and error state"). |
| Permission Denied | ❌ | No blueprint. |
| Session Expired | 🟡 | `client/api/client.ts` clears session on 401-fail (per `client/CLAUDE.md` §"API"); no branded page. |
| Update Required | ❌ | No blueprint. |

---

## Counts (rough)

- ✅ Shipped: ~70 items (anchored in `api/` routes + `web/` + `client/`).
- 🟡 Planned: ~25 items (named in blueprints or partially wired).
- ⬜ Backlog: ~25 items (no blueprint, not forbidden).
- ❌ Out of scope: ~160 items (most of §0 marketing surface, §11 speaking, §26
  subscription, §29 admin, large parts of §0–§28).

These are not commitments; they are a way to read the gap between a generic
SaaS sitemap and what the repo actually contains.

---

## Update policy

When a new milestone lands:

1. Re-verify every ✅ entry still resolves (route exists, screen still mounts).
2. Re-classify any 🟡 entry whose milestone closed.
3. Leave ⬜ and ❌ alone unless an explicit decision moves them.
4. Bump the version/date in the header.

This file is the single source of truth for "what does langapp do today."
`web/docs/product/FEATURES.md` is the human-readable version of the same fact;
keep them in step.
