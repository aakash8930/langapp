# Deploy unit files

These are **templates** — copy them into place on the box, don't symlink the
ones from the repo (the deploy clone doesn't check these out, the API service
unit is in `~/.config/systemd/user/` directly, and so is this one).

## Files

| File | Goes to |
|---|---|
| `langapp-web.service` | `~/.config/systemd/user/langapp-web.service` |
| `genko-health-monitor.service` | `~/.config/systemd/user/genko-health-monitor.service` |
| `genko-health-monitor.timer` | `~/.config/systemd/user/genko-health-monitor.timer` |

## Install steps

```bash
mkdir -p ~/.config/systemd/user
cp /home/aakash/Projects/langapp/deploy/langapp-web.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now langapp-web.service
systemctl --user status langapp-web.service --no-pager | head
```

## External health alerting

Create `~/.config/genko/monitor.env` outside Git:

```bash
HEALTH_URL=https://public.example/api/health
ALERT_WEBHOOK_URL=https://operations-webhook.example/...
```

Install and exercise the transition-aware monitor:

```bash
cp deploy/genko-health-monitor.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now genko-health-monitor.timer
systemctl --user start genko-health-monitor.service
journalctl --user -u genko-health-monitor.service -n 20
```

The script sends one generic notification when health changes to down and one
when it recovers; it does not place health response bodies or credentials in the
webhook. The receiver must be owned by operations and page a human.

## Deploy script hookup

`~/deploy/langapp-deploy.sh` builds `web/` and bounces `langapp-web.service`
on every git pull. The exact lines to add are in the README at the bottom of
this repo's root, in the deployment section.

## Funnel mount

The Funnel needs a second mount: `/learn` → `127.0.0.1:7703`. The API is
already mounted at `/langapp` → `127.0.0.1:7702`; the web lives at the same
hostname, just a different path, so they share origin and the existing
`CORS_ORIGINS` does not need a new entry. The exact command is in the
deployment section of the root README.