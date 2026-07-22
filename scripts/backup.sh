#!/usr/bin/env bash
#
# Nightly backup of the langapp database.
#
# §11 of the blueprint calls this required, not optional: the laptop holds the
# only copy of the database, and there is exactly one Mongo shared by dev and
# the deployed instance — so a bad seed or a dropped collection takes production
# with it.
#
# Follows the convention already on this machine (see ~/blitzcore_autobackup.sh):
# timestamped directories under a backup root, a log line per run, and rotation
# that keeps the most recent N.
#
# ⚠️ **This is a same-disk backup.** §11 asks for a *cloud-synced* folder and
# there is no sync client installed here, so this protects against every failure
# except the one that loses the disk. See scripts/README.md.
set -euo pipefail

DB=langapp
# Host port is 27018 — 27017 is usually taken by a system-level mongod.
URI="mongodb://127.0.0.1:27018/$DB"
ROOT="${LANGAPP_BACKUP_ROOT:-$HOME/langapp_backups}"
KEEP=14

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEST="$ROOT/$TIMESTAMP"
LOG="$ROOT/backup.log"

mkdir -p "$DEST"

# --archive + --gzip writes a single file rather than a directory tree, which
# makes rotation and restore-verification a one-liner each.
if ! mongodump --uri="$URI" --archive="$DEST/$DB.archive.gz" --gzip --quiet; then
  echo "[$(date -Is)] FAILED: mongodump exited non-zero" >> "$LOG"
  # Leave no half-written archive to be mistaken for a good one.
  rm -rf "$DEST"
  exit 1
fi

SIZE=$(du -h "$DEST/$DB.archive.gz" | cut -f1)

# ---------------------------------------------------------------------------
# Verify the archive by restoring it, before it is allowed to count as a backup
# ---------------------------------------------------------------------------
#
# A dump that restores to nothing is worse than no dump, because it looks like
# safety. So every archive is read back into a scratch database and counted
# there, and an archive that will not restore is deleted rather than kept.
#
# The counts therefore describe **the archive**, not the live database. That
# distinction is not pedantic: the first version of this script counted the
# live database after dumping, and the two disagreed within seconds because
# someone was completing lessons at the time. A backup is taken *of a moving
# system*; the only honest description of it is the one read back out.
SCRATCH="${DB}_backupcheck"
mongosh "mongodb://127.0.0.1:27018/$SCRATCH" --quiet --eval 'db.dropDatabase()' > /dev/null

if ! mongorestore --uri="mongodb://127.0.0.1:27018" --archive="$DEST/$DB.archive.gz" \
     --gzip --nsFrom="$DB.*" --nsTo="$SCRATCH.*" --quiet; then
  echo "[$(date -Is)] FAILED: archive would not restore" >> "$LOG"
  rm -rf "$DEST"
  exit 1
fi

COUNTS=$(mongosh "mongodb://127.0.0.1:27018/$SCRATCH" --quiet --eval '
  JSON.stringify({
    kanaItems: db.kanaItems.countDocuments(),
    vocabItems: db.vocabItems.countDocuments(),
    grammarPoints: db.grammarPoints.countDocuments(),
    lessons: db.lessons.countDocuments(),
    users: db.users.countDocuments(),
    srsCards: db.srsCards.countDocuments(),
  })')

mongosh "mongodb://127.0.0.1:27018/$SCRATCH" --quiet --eval 'db.dropDatabase()' > /dev/null

# Content is seeded and can be regenerated; users and their cards cannot. An
# archive holding no users when the live database has some is a real failure,
# not a quiet one.
LIVE_USERS=$(mongosh "$URI" --quiet --eval 'print(db.users.countDocuments())')
ARCHIVE_USERS=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['users'])" "$COUNTS")
if [[ "$LIVE_USERS" -gt 0 && "$ARCHIVE_USERS" -eq 0 ]]; then
  echo "[$(date -Is)] FAILED: archive has no users but the database has $LIVE_USERS" >> "$LOG"
  rm -rf "$DEST"
  exit 1
fi

echo "$COUNTS" > "$DEST/counts.json"
echo "[$(date -Is)] ok $DEST/$DB.archive.gz ($SIZE) verified $COUNTS" >> "$LOG"

# Rotation: keep the newest $KEEP timestamped directories.
ls -1t "$ROOT" | grep -E '^[0-9]{8}_[0-9]{6}$' | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -rf "${ROOT:?}/$old"
done

echo "Backed up $DB to $DEST/$DB.archive.gz ($SIZE)"
echo "$COUNTS"
