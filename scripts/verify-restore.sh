#!/usr/bin/env bash
#
# Restore the most recent backup into a scratch database and check it came back
# whole.
#
# This is the part that makes the backup mean something. A `mongodump` that
# exits 0 proves it wrote a file, not that the file can be read back — and an
# untested backup is a belief, not a safeguard. OPEN-ITEMS #6 and #20 both
# arrive at the same conclusion: the restore test is the real guard.
#
# Restores to `langapp_restorecheck`, never to `langapp`. Nothing here can
# damage live data, which is what makes it safe to run on a whim.
#
#   scripts/verify-restore.sh            # newest backup
#   scripts/verify-restore.sh 20260722_213000
set -euo pipefail

DB=langapp
SCRATCH="${DB}_restorecheck"
HOST="mongodb://127.0.0.1:27018"
ROOT="${LANGAPP_BACKUP_ROOT:-$HOME/langapp_backups}"

STAMP="${1:-$(ls -1t "$ROOT" 2>/dev/null | grep -E '^[0-9]{8}_[0-9]{6}$' | head -1 || true)}"
if [[ -z "$STAMP" ]]; then
  echo "No backups found in $ROOT — run scripts/backup.sh first." >&2
  exit 1
fi

ARCHIVE="$ROOT/$STAMP/$DB.archive.gz"
EXPECTED_FILE="$ROOT/$STAMP/counts.json"
[[ -f "$ARCHIVE" ]] || { echo "Missing archive: $ARCHIVE" >&2; exit 1; }

echo "Verifying $STAMP"

# Always start from empty, or a previous run's leftovers would mask a dump that
# restored nothing at all.
mongosh "$HOST/$SCRATCH" --quiet --eval 'db.dropDatabase()' > /dev/null

mongorestore \
  --uri="$HOST" \
  --archive="$ARCHIVE" \
  --gzip \
  --nsFrom="$DB.*" \
  --nsTo="$SCRATCH.*" \
  --quiet

ACTUAL=$(mongosh "$HOST/$SCRATCH" --quiet --eval '
  JSON.stringify({
    kanaItems: db.kanaItems.countDocuments(),
    vocabItems: db.vocabItems.countDocuments(),
    grammarPoints: db.grammarPoints.countDocuments(),
    lessons: db.lessons.countDocuments(),
    users: db.users.countDocuments(),
    srsCards: db.srsCards.countDocuments(),
  })')

echo "  expected: $(cat "$EXPECTED_FILE")"
echo "  restored: $ACTUAL"

# Compare through a parser rather than as strings — key order out of mongosh is
# stable in practice but nothing guarantees it.
if ! python3 - "$EXPECTED_FILE" "$ACTUAL" <<'PY'
import json, sys
expected = json.load(open(sys.argv[1]))
actual = json.loads(sys.argv[2])
if expected != actual:
    print("  MISMATCH:")
    for key in sorted(set(expected) | set(actual)):
        want, got = expected.get(key), actual.get(key)
        if want != got:
            print(f"    {key}: expected {want}, restored {got}")
    sys.exit(1)
PY
then
  echo "RESTORE VERIFICATION FAILED — this backup is not trustworthy." >&2
  exit 1
fi

# The scratch database is left in place on purpose: if you are running this
# after a real loss, it is where the data is. Drop it when you are done.
echo "OK — every collection restored with the document count it was dumped at."
echo "Restored copy left at $HOST/$SCRATCH; drop it with:"
echo "  mongosh \"$HOST/$SCRATCH\" --eval 'db.dropDatabase()'"
