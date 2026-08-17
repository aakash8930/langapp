# Ops scripts

## Public release preflight

Run the non-destructive external checks before and after the final deployment:

```bash
API_URL=https://public.example/api \
WEB_URL=https://public.example/learn \
./scripts/release-preflight.sh
```

This is only the automated portion of `RELEASE-CHECKLIST.md`; mail delivery,
account acceptance, Android, restore, and rollback checks require recorded
operator evidence.

## Backups

A nightly production backup is **required, not optional**. Production must use
Mongo, Redis, and object storage isolated from development — a development seed,
migration, queue purge, or container restart must never affect public accounts.

```bash
scripts/backup.sh                       # dump, verify, rotate
scripts/verify-restore.sh               # restore the newest backup to a scratch db
scripts/verify-restore.sh 20260722_0320 # or a specific one
```

Backups land in `~/langapp_backups/<timestamp>/` — matching the convention
already used by `~/blitzcore_autobackup.sh` on this machine — with a
`backup.log` line per run and the newest 14 kept.

A nightly systemd user timer runs it at 03:20:

```bash
systemctl --user status langapp-backup.timer
systemctl --user start langapp-backup.service   # run one now
journalctl --user -u langapp-backup -n 20
```

`Persistent=true` matters: a laptop asleep at 03:20 backs up on the next boot
rather than skipping the night silently, which is the failure mode that leaves
people believing they have backups.

### Every backup verifies itself

`backup.sh` restores each archive into a scratch database and counts it there
before accepting it. An archive that will not restore is **deleted**, and the
run exits non-zero — you never keep a file that only looks like safety.

The counts in `counts.json` therefore describe *the archive*, not the live
database. That distinction is not pedantic. The first version of this script
counted the live database after dumping, and the two disagreed within seconds,
because someone was completing lessons while it ran. A backup is taken of a
moving system; the only honest description of one is what you read back out.

There is also a specific guard for the case that actually costs something:
if the live database has users and the archive has none, the backup fails.
Seeded content can be regenerated with `npm run seed`. Accounts and their
review cards cannot.

### Off-device production requirement

The local verified archive protects against bad seeds and accidental deletion,
but not disk loss. Production therefore sets `REQUIRE_OFFSITE_BACKUP=1` and one
of these transfer mechanisms:

```bash
LANGAPP_CLOUD_SYNC_CMD='rclone copy "$DEST/langapp.archive.gz" remote:genko-backups/'
# or a mounted/synchronised destination:
LANGAPP_CLOUD_SYNC_DIR=/mnt/offsite/genko-backups
```

Put the variables in `~/.config/systemd/user/langapp-backup.service` using
`Environment=`. A configured command must exit successfully. A directory copy
is byte-compared with the local verified archive. With
`REQUIRE_OFFSITE_BACKUP=1`, no mechanism or a failed transfer makes the backup
service fail so monitoring can alert instead of reporting partial safety.
