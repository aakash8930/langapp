# GENKŌ platform audit closure

**Updated:** 2026-08-16

**Scope:** web acquisition/authentication, shared account and first-run contracts, delivery/operations, content integrity, dependency risk, and CI across API, web, and Expo.

## Executive summary

The audited backlog is implemented. Browser authentication no longer exposes bearer credentials to JavaScript; first-run account state is enforced by both API guards and central web/native routing; onboarding now changes a deterministic, explainable curriculum recommendation; contact and mail flows no longer claim delivery they cannot confirm; required content and stroke assets are versioned and verified; and each package has clean-install quality and dependency gates.

The only accepted dependency findings are three advisory IDs propagated through Expo 57 developer build tooling. They are narrowly documented and CI fails if any new advisory appears. Browser-created bookmarks, lists, decks, deck activity, and writing corrections remain intentionally local, but that boundary is now disclosed in Data & Storage rather than implied to sync.

## Completed contracts

| Area | Implemented outcome | Enforcement |
|---|---|---|
| Browser first run | One browser journey covers signup, queued-delivery copy, six-digit verification, authoritative account-state redirect, all three onboarding choices, and dashboard entry. | `web/e2e/account-first-run.spec.ts`; Playwright Chromium in CI. |
| Web quality baseline | Conditional hooks, callback dependencies, route generation, and entry-budget parsing are fixed. The generated TanStack route tree is committed for cold typechecks. | Web lint, typecheck, build/budget, route-tree diff, and E2E are required CI steps. |
| Dependencies | Web and API production audits are clean. Expo residuals are the `image-size` parser DoS advisories and `uuid` caller-buffer advisory carried by Metro/`xcode`. | `audit:prod` in all packages; `client/SECURITY-AUDIT.md` and advisory-ID script reject new findings. |
| Explainable recommendation | Persisted starting level and primary goal select kana, N5 vocabulary/grammar/kanji, or N4 vocabulary/grammar/kanji. N3–N1 explicitly fall back to the highest seeded N4 content. | Pure mapping tests, progress response contract, dashboard explanation, and verifier that every recommended unit exists. |
| Browser auth | Access and refresh tokens are HttpOnly SameSite cookies (Secure in production). Unsafe cookie-authenticated requests require matching CSRF cookie/header values. Refresh remains single-flight and rotating. Legacy Web Storage keys are deleted. | Browser auth facade, cookie service, guard tests, CSRF tests, credentialed strict-origin CORS. Native bearer/SecureStore behavior remains supported and unchanged. |
| Contact delivery | The public form calls a rate-limited, validated, honeypot-protected endpoint and reports success only after Redis accepts a real contact mail job. | `POST /contact`, 202/503 contract, escaped rendering, service tests, preserved form input on failure. |
| Legal consent | Both web and native require an explicit Terms/Privacy checkbox. The API refuses missing acknowledgement and records canonical terms/privacy versions plus acceptance time outside ordinary user responses. | Shared registration contract, schema evidence, service tests, canonical legal constants. |
| Reminder claims | Native study reminders retain device scheduling. Web calls them in-app reminders and explicitly says browser push is not enabled. | Settings/profile copy and notification-setting API contract. |
| Mail operations | Resend is the production-preferred provider; SMTP is the development fallback. Admin smoke delivery uses the real queue/worker/provider path. Terminal failures are retained and degrade `/health`, connecting them to health monitoring. | `POST /admin/mail/smoke`, `MAIL_SMOKE_TO`, retry/terminal tests, health failure counts and 503. |
| Brand | Product-facing metadata, PWA install name, web/native auth surfaces, status page, emails, and admin default use **GENKŌ**. Technical package/service names remain stable. | Source metadata and branding regression assertions. |
| Required content | The authored baseline is 208 kana seed rows, 929 vocabulary rows, 32 grammar points, 188 kanji entries, and 114 lessons. Every kana seed must receive lesson attribution. | `verify:content`, seed-time attribution failure, twice-run CI seed. |
| Stroke order | The full 6,703-character normalized KanjiVG pack is versioned for dictionary and future-course use. All files have an immutable source revision, SHA-256 manifest, valid non-empty paths, filename/character agreement, and the 336 taught glyphs are a required subset. | `api/storage/strokes`, `NOTICE`, manifest and deterministic verifier. |
| Audio | Kana and vocabulary prefer a generated, verified WAV pack; web and Expo use Japanese system-voice fallback when a recording is absent. AI tutor replies are speakable on both clients, with non-Japanese translation text removed before TTS. | Atomic generator, complete coverage/hash manifest, web Speech Synthesis, Expo Speech, and immutable API routes. |
| Public-free launch | New checkout is disabled and the only advertised plan is the free public MVP. Cookie and refund pages state the actual storage and no-charge contracts rather than placeholder terms. | API rejects free checkout; web access, billing, landing, and legal surfaces align. |
| Sync boundary | Account/profile/onboarding/lesson/review/XP/streak/settings/social data are identified as server-synced. Browser bookmarks, lists, custom decks/activity, and writing corrections are identified as local and excluded from server export. | Data & Storage disclosure; cache-clearing copy no longer implies those records are removed or synced. |
| Web auth consolidation | Registration is only `/signup`; sign-in/recovery is only `/signin`; the landing page uses dedicated auth links. | Duplicate compact `SignIn` component removed. |
| Password policy | New registration, reset, and change-password values require 12–128 characters and allow passphrases without arbitrary composition rules. Existing/current-password authentication remains compatible. | API policy constants and aligned web/native validation. |
| API fixtures | DTO, seed, exercise, practice, social, user, queue, mail, and auth fixtures match current contracts. | Full API typecheck and test suite. |
| CI | API audits/typecheck/build/tests/content verification/boot/twice-seed; web audit/lint/typecheck/build/generated-tree/E2E; Expo advisory gate/typecheck/Android export. | `.github/workflows/ci.yml`. |

## Operational follow-up

The sandbox has no production mail credentials, so it cannot truthfully claim a provider accepted a live external message. After deployment, set `MAIL_SMOKE_TO`, invoke `POST /admin/mail/smoke` with an administrator session, confirm the message in that inbox, and verify `/health` remains healthy. Any terminal delivery failure now makes that health check return 503 with retained failure counts.

The Expo advisory exceptions should be removed as soon as compatible Expo/Metro/`xcode` releases resolve them. The audit script prints stale IDs when that happens and continues to fail on every unreviewed advisory.
