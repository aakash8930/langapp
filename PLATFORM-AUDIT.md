# GENKŌ platform audit

**Date:** 2026-08-16  
**Scope:** web acquisition/authentication, shared account contract, first-run onboarding, and a static product/engineering review of the web, API, and Expo client. The production API and email provider were not exercised in this workspace.

## Executive summary

GENKŌ already has a unusually broad Japanese-learning feature set: a structured course, kana/kanji/grammar libraries, listening/speaking/writing practice, account-backed FSRS review, JLPT surfaces, progress, and cross-device accounts. The largest issue is not feature count; it is cohesion. Several screens promise personalization or account behavior that is only partly wired, and the platform has more routes than the current quality gates can protect.

The signup path had concrete conversion blockers: its stylesheet was never imported, registration was duplicated inside two sign-in surfaces, OAuth controls led to API routes that do not exist, a stricter client-only password policy rejected valid API passwords, and successful web registration skipped both verification and onboarding. Those issues are addressed in this branch.

## Completed in this pass

| Area | Problem found | Change |
|---|---|---|
| Signup rendering | `/signup` did not import `signup.css`, so the dedicated route could render without its intended UI. | The route now imports its stylesheet explicitly. |
| Product fit | The signup hero was decorative Japanese wallpaper and did not explain the learning product. | Rebuilt it around the real course, spaced review, cross-device progress, and a first-lesson preview. |
| Flow | Registration navigated straight to `/`, leaving the existing verification and personalization screens orphaned. | The flow is now **Account → Verify email → Personalize → Learn**. Verification continues into onboarding. |
| Authentication IA | `/signin`, the landing form, and `/signup` each offered a different registration path. | Registration is canonical at `/signup`; both sign-in surfaces link there. |
| Dead controls | Google, GitHub, and Apple buttons redirected to backend routes that do not exist. | Removed the controls. OAuth should return only after a provider, callback, account-linking, and failure flow exist. |
| Form UX | The submit button was disabled until the form was valid, preventing submit from revealing untouched errors. | Submit now validates, focuses the first invalid field, and only disables during the request. |
| Account semantics | The UI requested a “Full Name” although the API stores a public `displayName`. | It now asks for a display name and explains where it appears. |
| Password contract | Web and native required character classes that `RegisterDto` does not require. | Both clients now enforce the API’s 8–128 character bounds; the meter presents other checks as suggestions. |
| Age validation | Browser date parsing could normalize impossible dates and mix UTC/local calendar parts. | Signup now validates real UTC calendar dates and uses the same 13+ boundary as the API. |
| Recovery copy | UI copy referred to reset/verification codes in the API server log although the API now queues email. | Recovery and verification now refer to the learner’s email. |
| Onboarding reliability | Web onboarding swallowed every save failure and allowed repeated clicks. | Save errors are visible, controls lock while saving, and the returned user refreshes the session cache. |
| Reminder consent | The onboarding toggle wrote `onboardingState.notificationsEnabled`, while the worker reads `notificationSettings.studyReminders`; new users also defaulted to reminders on. | The API now writes both fields, defaults reminders off, and has regression coverage for opt-in and opt-out. |
| Auth takeover layout | `/verify-email` was the only first-run screen still rendered through the app shell. | Verification now uses the same focused takeover layout as signup, sign-in, and onboarding. |
| Email delivery observability | Queue failures were discarded, worker errors were swallowed, configuration was absent from validated env, and `/health` could not describe mail. | Every mail has a delivery UUID/kind; registration exposes queue acceptance, resend surfaces queue outage, reset remains anti-enumerating, provider failures retry, retained queue counts and configuration appear in health, and logs distinguish provider acceptance, retries, and terminal failure without recipient data. |
| Account-state enforcement | Verification/onboarding were client-side navigation only; deep links and direct API requests bypassed them. | API learning/product controllers now compose JWT and persisted account-state guards. `/me` and auth/session recovery remain available, onboarding requires verified email, required personalization is validated server-side, and completion cannot be reversed. |
| Cross-client first run | Web lacked central redirects and native had neither verification UI nor verified-state routing. | Web centrally redirects by authoritative session state and shows registration delivery status. Native now models `emailVerified`, provides verify/resend UI, blocks unknown offline state, and routes **Verify → Personalize → Learn** with sign-out exits on both gates. |

## Remaining issues, prioritized

### P0 — resolve before scaling acquisition

1. **The first production bundle is too large for an acquisition flow.** The current web build emits roughly **1.36 MB JavaScript** and **615 KB CSS** before gzip. Signup should not download hundreds of feature routes before showing its first field. Add route-level code splitting and split feature CSS by route; measure signup LCP and interaction latency on a mid-range phone.

2. **Dependency audit findings need triage.** Installation reported one high-severity web finding, three API findings, and 18 high-severity Expo/client findings. Do not run a blind forced upgrade; identify reachable production paths, update direct dependencies first, and record accepted transitive risk.

### P1 — high product/trust impact

5. **Onboarding is ten steps before first value.** Language products retain learners by getting them into a useful first exercise quickly. Reduce first run to three decisions: starting level, primary goal, and sustainable daily commitment. Ask learning style, reminder timing, and other preferences contextually after the learner has completed a lesson.

6. **Most “personalization” answers are stored but do not personalize learning.** `proficiencyLevel`, `learningGoals`, `learningStyle`, and `studyTimeMinutes` are persisted and returned, but no recommendation/path service consumes them. Either wire them into a transparent starting-path decision or stop claiming they tailor the course.

7. **The placement-test step advertises a test that cannot be started.** It promises “15 quick questions,” “adaptive difficulty,” and vocabulary/grammar coverage, but the primary action is “Skip for now.” Build a scored placement flow tied to lesson prerequisites, or replace this step with an honest “Choose where to start” option.

8. **Web reminder language exceeds web capability.** The setting now correctly controls in-app reminder generation, but the web does not request browser push permission. Label the channel as “in-app reminders”; only promise device notifications on the native client where permission and scheduling exist.

9. **Auth/session tokens remain in `localStorage`.** An XSS can steal both access and refresh tokens. Before adding user-generated HTML, analytics scripts, or embeds, migrate the browser flow to secure, httpOnly, SameSite cookies with CSRF protection and strict credentialed CORS.

10. **Contact form success is false-positive behavior.** The public contact route calls an authenticated admin broadcast endpoint, catches every failure, and then displays “Message sent.” Build a public, rate-limited contact endpoint with spam controls and real delivery status, or remove the form.

11. **Web onboarding accessibility is incomplete.** Several choices are clickable `div` elements; some handle Enter but not Space, checkbox groups lack native controls, and labels are not consistently bound to fields. Convert choices to native radio/checkbox inputs inside `fieldset`/`legend` groups and run keyboard plus screen-reader checks.

12. **Legal consent is not a platform contract.** Web now presents Terms/Privacy acknowledgment, but the native flow does not and the API stores no terms version or acceptance timestamp. Legal review should decide whether acknowledgment is required; if it is, enforce and version it consistently rather than relying on a browser-only checkbox.

13. **There is no web test runner.** Signup validation, age boundaries, auth error normalization, and onboarding transitions now contain business rules but are protected only by TypeScript/build. Add focused unit tests and one browser-level happy-path/error-path auth suite.

### P2 — quality and platform coherence

14. **Brand identity is inconsistent.** The PWA manifest says “LangApp,” HTML title says “langapp,” authentication says “GENKŌ,” and older navigation uses “日本語.” Choose one product name and update metadata, install surfaces, email sender, app config, and legal pages together.

15. **The product surface is wider than the data behind it.** Repository notes identify missing stroke-order seed data and absent kana `taughtInLesson` attribution. These gaps make writing/tracing features look broken even when their components are correct. Add seed verification to CI and fail content builds when required packs are empty.

16. **Local-only learner work conflicts with cross-device expectations.** Some writing records, custom decks, bookmarks, and practice history are browser-local while account progress is synced. Continue labeling that boundary clearly, then prioritize server models for the learner-created data whose loss would hurt most.

17. **Authentication behavior is still implemented twice on web.** Registration is now canonical, but the landing-page sign-in/recovery card and dedicated `/signin` form duplicate state and error handling. Extract a shared auth action hook or remove the compact form in favor of the dedicated route.

18. **Current lint is not green.** Existing failures include conditional hooks in billing and hooks inside an anonymous contact route component; there is also a missing dependency warning in kana listening. Fix these baseline failures so lint can become a meaningful merge gate rather than expected noise.

19. **Password minimum should be revisited as one contract.** This pass removed accidental client-only complexity and aligned all surfaces to the current 8-character API rule. A future security change should prefer longer passphrases and breached-password checks, then update API, web, native, reset, and change-password flows in the same release.

## Recommended next sequence

1. Cut onboarding to a fast, honest starting-path flow and remove or build the placement-test promise.
2. Code-split the web app so public auth/landing routes load independently of the learning suite.
3. Add browser-level auth/onboarding tests and clear the existing lint baseline.
4. Connect stored goals/level to an explainable course recommendation.
5. Seed and verify stroke-order/lesson-attribution content before expanding more practice routes.
