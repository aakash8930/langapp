# Workspace rules

AI-native language learning platform. Phase 0 = Japanese only, single learner flow.
Full spec lives in `PHASE-0-BLUEPRINT.md`. Read it before making architectural
decisions.

This is a **monorepo with no workspace tooling** — no npm workspaces, no Nx, no
Turborepo, no shared root `package.json`. Each app owns its own dependencies and
is built independently. Don't introduce a workspace manager without asking.

## Layout

```
api/                    NestJS backend — see api/CLAUDE.md for its rules
  docker-compose.yml    mongo + redis
client/                 Expo app — NOT YET SCAFFOLDED
scripts/                ops scripts (backup.sh) — NOT YET WRITTEN
PHASE-0-BLUEPRINT.md    the spec
OPEN-ITEMS.md           deferred decisions and trade-offs, ordered by urgency
```

Each app has its own `CLAUDE.md`. When working inside an app, that file's rules
apply on top of these.

## Commands

Infra lives with the backend:

```bash
cd api && docker compose up -d    # mongo :27018, redis :6379
```

`api/docker-compose.yml` sets a top-level `name: langapp`. That pin is
load-bearing — compose otherwise derives the project from the directory, and the
volumes holding all dev data are namespaced `langapp_mongo-data` /
`langapp_redis-data`. Drop the pin and compose creates empty `api_*` volumes,
leaving the real data orphaned and the database apparently wiped.

Per-app commands live in each app's `CLAUDE.md`. Nothing at the root builds or
tests the apps — `cd` into one first.

## Deployment

Stage A runs on the laptop: a systemd timer polls `origin/main` every minute and
redeploys on change. `git push origin main` is the deploy trigger.

The deploy clone lives at `~/deploy/langapp` and is a **separate checkout** with
its own untracked `.env` holding its own JWT secrets. Anything that changes where
the API's working directory or entrypoint lives must be mirrored in
`~/deploy/langapp-deploy.sh` and the `langapp-api.service` unit, or deploys break.

## Working style

- Work one milestone at a time. Stop and report after each; don't chain ahead.
- Don't add npm dependencies without asking first.
- Prefer boring, obvious code over clever abstractions. This is a solo-maintained repo.
- When something in `PHASE-0-BLUEPRINT.md` is ambiguous, ask rather than assume.
- A change that touches both apps still lands as one commit — they version together.
