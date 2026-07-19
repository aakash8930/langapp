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
web/                    frontend — NOT YET SCAFFOLDED, stack undecided
docker-compose.yml      mongo + redis, shared by both apps
PHASE-0-BLUEPRINT.md    the spec
OPEN-ITEMS.md           deferred decisions and trade-offs, ordered by urgency
```

Each app has its own `CLAUDE.md`. When working inside an app, that file's rules
apply on top of these.

## Commands

Infra is shared and runs from the root:

```bash
docker compose up -d      # mongo :27018, redis :6379
```

Compose **must** be run from this directory. The project name is derived from the
directory name (`langapp`), and the containers use explicit names
(`langapp-mongo`, `langapp-redis`). Running compose from a subdirectory creates a
different project and collides on those container names.

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
