# Deploy unit files

These are **templates** — copy them into place on the box, don't symlink the
ones from the repo (the deploy clone doesn't check these out, the API service
unit is in `~/.config/systemd/user/` directly, and so is this one).

## Files

| File | Goes to |
|---|---|
| `langapp-web.service` | `~/.config/systemd/user/langapp-web.service` |

## Install steps

```bash
mkdir -p ~/.config/systemd/user
cp /home/aakash/Projects/langapp/deploy/langapp-web.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now langapp-web.service
systemctl --user status langapp-web.service --no-pager | head
```

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