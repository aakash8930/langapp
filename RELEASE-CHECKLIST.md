# GENKŌ public MVP release checklist

**Owner:** release operator  
**Rule:** do not announce public availability until every required row has dated evidence.

This is an operational gate, not a roadmap. A green build proves that code can be assembled; it does not prove that external mail arrives, a backup restores, or the public hostname works from a learner's network.

## 1. Infrastructure isolation — required

Development and production must not share a Mongo database, Redis database, storage directory, or Compose volume. A local `npm run seed`, migration, queue purge, or Docker restart must not affect public users.

Record the non-secret identifiers below. Do **not** paste credentials into this file.

| Check | Required evidence | Date/operator |
|---|---|---|
| Production Mongo is distinct | Redacted host plus database name; neither is the development `langapp` database on port 27018 | |
| Production Redis is distinct | Redacted host plus logical DB/instance; not the development container on port 6380 | |
| Production object storage is distinct | Production `STORAGE_DIR` or bucket identifier | |
| Development isolation proved | Create a disposable development record and show production counts do not change | |
| Production secrets | Different access/refresh secrets from development; stored outside Git | |

Suggested database names are `langapp_dev`, `langapp_staging`, and `langapp_prod`. Prefer separate instances/credentials as well as separate names. The production account should have access only to production data.

## 2. Automated public preflight — required

From a network outside the production host:

```bash
API_URL=https://public.example/api \
WEB_URL=https://public.example/learn \
./scripts/release-preflight.sh
```

Attach the complete successful output to the release record. It checks the public health endpoint, seeded catalog, legal documents, web entry document, and browser CORS allowlist without modifying data.

| Check | Date/operator |
|---|---|
| Public preflight passes from an external network | |
| Public preflight passes once more after the final deployment | |

## 3. Real account acceptance — required

Use a new operations-owned inbox, not an existing account. Keep browser developer tools open and record HTTP status/error evidence without recording passwords, cookies, reset codes, or tokens.

- [ ] Register on the public web app and see honest queued-delivery copy.
- [ ] Receive the six-digit verification email externally.
- [ ] Verify the account and confirm the authoritative redirect to onboarding.
- [ ] Complete all onboarding choices and reach the dashboard.
- [ ] Complete one lesson, including at least one wrong and one correct answer.
- [ ] Reload and sign in again; lesson completion, XP, and streak remain.
- [ ] Open the review queue, grade a card, reload, and confirm the new schedule remains.
- [ ] Request password recovery, receive the external email, reset, and sign in with the new password.
- [ ] Send the public contact form and confirm the message reaches `CONTACT_TO`.
- [ ] Start an AI tutor session, send a message, and receive a valid reply.
- [ ] Sign out and confirm authenticated data is no longer available.
- [ ] Export account data and inspect the JSON.
- [ ] Delete this disposable acceptance account and confirm it cannot sign in.

Record date, operator, browser/version, account email, and release commit SHA in the release record. Never record credentials or verification codes.

## 4. Mail path — required

Production must have `MAIL_SMOKE_TO`, `CONTACT_TO`, `MAIL_FROM`, and either Resend or SMTP credentials configured.

- [ ] As an administrator, invoke `POST /admin/mail/smoke` through the deployed API.
- [ ] Confirm the exact message arrives at `MAIL_SMOKE_TO`.
- [ ] Confirm `/health` remains 200 after the worker processes it.
- [ ] Confirm verification mail, reset mail, and contact mail through section 3.
- [ ] Confirm the health monitor pages an operator when `/health` returns 503.

## 5. Backup and rollback — required

Run against production only after infrastructure isolation is complete:

```bash
REQUIRE_OFFSITE_BACKUP=1 scripts/backup.sh
scripts/verify-restore.sh
```

- [ ] A new production archive was created.
- [ ] The archive restored into a scratch database.
- [ ] Restored user and learning-record counts are non-zero and plausible.
- [ ] The off-device copy exists and byte verification passed.
- [ ] An operator can locate the latest known-good application commit.
- [ ] An operator can restore the database without consulting undocumented shell history.
- [ ] Seed and migration rollback procedures were rehearsed on staging or a restored copy.

Record archive timestamp, encrypted off-site destination identifier, restore result, and operator. Do not record storage credentials.

## 6. Android acceptance — required for Android announcement

- [ ] Build the final production APK from the release commit.
- [ ] Install it on a clean physical Android device.
- [ ] Verify signup/sign-in, lesson, review, AI, and sign-out against production.
- [ ] Install it over the previous APK and confirm the signing key permits upgrade.
- [ ] Confirm `versionCode` increased and the keystore has a protected backup.
- [ ] Publish a stable authenticated or public download location and update instructions.

## 7. Public-surface review — required

- [ ] No navigation advertises paid billing, study groups, or another placeholder.
- [ ] Landing and FAQ state that the MVP is free and online-only.
- [ ] Landing and FAQ claim only beginner/N5/N4 authored content.
- [ ] Browser-local bookmarks, lists, decks, and writing records are clearly disclosed as local.
- [ ] Terms, Privacy, Cookies, and Refund pages match actual behavior.
- [ ] Support contact and operational owner are known.

## Release decision

| Field | Value |
|---|---|
| Commit SHA | |
| API deployment/version | |
| Web deployment/version | |
| Android version/versionCode | |
| Release operator | |
| Evidence reviewed by | |
| Decision and timestamp | |

A waiver must name the failed check, user impact, owner, deadline, and rollback trigger. “Works locally” is not a waiver.
