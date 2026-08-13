# LangApp Admin

Standalone, authenticated administrator console for LangApp.

## Run locally

```bash
cd admin
cp .env.example .env
npm install
npm run dev -- --host 0.0.0.0
```

Set `VITE_API_URL` to the API base URL (without `/v1`). The console signs in through `/v1/auth/login`, stores the issued token in browser local storage, and calls protected `/v1/admin/*` endpoints with a bearer token.

## Production requirements

1. Run the API with MongoDB and its normal environment configuration.
2. Promote a test account through a trusted server/database administration process so `isAdmin: true` is present in its signed JWT.
3. Add the deployed Admin Panel origin to the API's `CORS_ORIGINS` setting, for example `https://admin.example.com`.
4. Build Admin with `VITE_API_URL=https://api.example.com`.

The API is the authorization authority: every admin route requires both JWT authentication and the API's `AdminGuard`. The frontend does not grant access merely by hiding/showing controls.

## Current backend coverage

Live endpoints are connected for dashboard statistics, users, courses, lessons, vocabulary, kanji, grammar, reports, moderation reports, coupons, roles, analytics, notifications, settings, and audit logs. Other navigation areas remain deliberately disabled until equivalent protected API contracts exist.
