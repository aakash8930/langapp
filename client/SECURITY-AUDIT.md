# Expo production audit exceptions

**Rechecked:** 2026-08-17 after updating all compatible Expo 57 patch releases
and successfully exporting the Android bundle. The three upstream advisory IDs
remain in Expo/Metro build tooling; there is still no compatible npm resolution.

`npm run audit:prod` fails on every advisory except the exact IDs below. They
are propagated through Expo/Metro native build tooling, not application request
handling:

| Advisory | Package | Current exposure decision |
|---|---|---|
| 1138808 | `image-size` | Infinite loop while parsing a malicious ICNS file. Metro receives repository-controlled application assets during a developer/CI build; it does not parse learner uploads at runtime. |
| 1138809 | `image-size` | Infinite loop while parsing malicious JXL/HEIF metadata. Same developer-controlled Metro asset boundary. |
| 1119441 | `uuid` | Bounds issue only when v3/v5/v6 is called with a caller-provided buffer. It is pulled through `xcode`/Expo config tooling; GENKŌ does not invoke that API with user input. |

These are temporary transitive exceptions for Expo 57. The script keys on
advisory IDs rather than package names, so a new issue in Metro, Expo, `xcode`,
or any already-present package still fails CI. Do not replace this with
`npm audit fix --force`: npm currently proposes an incompatible Expo downgrade.
