#!/usr/bin/env bash
# Download upstream Japanese language datasets used by LangApp.
#
# This intentionally downloads *source files only*. It does not import anything
# into MongoDB and it does not put data in Git. Review the license for every
# source before running an importer or distributing derived content.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${LANGAPP_DATA_DIR:-$ROOT/data/raw}"
mkdir -p "$DEST"/{edrdg,kanjivg}

fetch() {
  local url="$1" out="$2"
  if [[ -s "$out" ]]; then
    echo "Already downloaded: ${out#$ROOT/}"
    return
  fi
  echo "Downloading: $url"
  curl --fail --location --retry 3 --retry-delay 2 --output "$out" "$url"
}

# EDRDG dictionary data — review EDRDG/CC BY-SA terms before redistribution.
fetch "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz" "$DEST/edrdg/JMdict_e.gz"
fetch "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz" "$DEST/edrdg/kanjidic2.xml.gz"
fetch "http://ftp.edrdg.org/pub/Nihongo/kradzip.zip" "$DEST/edrdg/kradzip.zip"

# KanjiVG release — review its CC BY-SA terms before redistribution.
fetch "https://github.com/KanjiVG/kanjivg/releases/download/r20220427/kanjivg-20220427.xml.gz" "$DEST/kanjivg/kanjivg.xml.gz"

cat <<EOF

Downloads complete in: $DEST

Next steps:
  1. Read data/README.md and data/sources.json.
  2. Verify every dataset's current license and attribution obligations.
  3. Run the matching LangApp importer once it has been reviewed.

Tatoeba and BCCWJ are intentionally not fetched automatically because their
chosen export/version and licensing scope should be recorded before import.
EOF
