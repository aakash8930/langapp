# GENKŌ Expo client product audit

**Audited:** 2026-08-17  
**Product boundary:** the Expo app is the focused learner product. It deliberately does not mirror the web feature directory.

## Primary experience

The authenticated app has four destinations:

1. **Today** — next lesson, daily XP, lesson count, streak, quick practice, tutor.
2. **Learn** — one ordered course path with only the current chapter expanded.
3. **Practice** — completed-lesson practice, unit checkpoint, combined test, tutor.
4. **Profile** — learning totals, checkpoint milestones, account and settings.

Lessons, tests, chat, messages, notifications, verification, onboarding, and settings are contextual screens. Their tab bar is hidden so focused flows do not compete with global navigation.

## Learning rules

- A new lesson presents its material before asking questions.
- Recognition and recall are both used.
- A wrong answer is normal learning: the same question remains until the corrected answer is produced. It does not fail the whole lesson.
- Progress is saved only after every exercise ends correct.
- Unit checkpoints are optional and never lock the course.
- Practice is learner-controlled; there is no mandatory review queue.
- AI is contextual support, not a tools marketplace.
- N3–N1 are not advertised as authored course levels. “N4 or above” falls back honestly to the highest available N4 content.

## Native configuration verified

- Expo SDK 57 and React Native 0.86.2 are aligned.
- The Hermes regression flagged on React Native 0.86.0 is fixed by 0.86.2.
- Required `expo-asset` peer dependency is installed explicitly.
- Android package: `com.aakash8930.langapp`.
- iOS bundle identifier: `com.aakash8930.langapp`.
- Deep-link scheme: `genko`.
- Typed Expo Router routes are enabled.
- Tokens use Expo SecureStore.
- Android builds are installable APKs with local version code 5.
- App/package version is aligned at 1.4.0.
- Development, preview, and production EAS profiles use explicit API URLs.

## Quality gates

- `npm run lint` — zero warnings/errors.
- `npm run typecheck` — clean.
- `npm test` — course ordering and display-policy tests pass.
- `npm run audit:prod` — only the three documented Expo build-tool advisories are allowed.
- Android Expo export — succeeds.
- Expo Doctor — 19/21 checks pass. The remaining two checks require Expo/React Native Directory network services and failed because those remote services reset the TLS connection, not because of a reported project mismatch.

## Remaining release dependency

All EAS profiles currently target the documented Tailscale Funnel API. Before a broad public release, replace that URL with the isolated, durable production API after the production acceptance checklist passes. No client code should assume the web app’s information architecture or deployment lifecycle.
