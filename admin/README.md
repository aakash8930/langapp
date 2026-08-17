# GENKŌ standalone admin console

This package is an internal development console. **It is excluded from the public MVP deployment.** The supported browser administration surface is the cookie-authenticated `/admin` area in `web/`.

The standalone console uses bearer credentials and keeps its session in browser local storage. Do not expose it on a public origin. It remains in CI so its existing internal workflows cannot silently stop compiling while they are migrated or retired.

## Run locally

```bash
cd admin
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

Set `VITE_API_URL` to the local API base URL. Use a disposable administrator account and clear site data when finished.

## Current backend coverage

Live endpoints are connected for dashboard statistics, users, courses, lessons, vocabulary, kanji, grammar, reports, moderation reports, coupons, roles, analytics, notifications, settings, and audit logs. Other navigation areas remain disabled until equivalent protected API contracts exist.

Every API route still requires JWT authentication and `AdminGuard`; frontend visibility is never the authorization boundary.
