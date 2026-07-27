#!/usr/bin/env python3
"""
Fetch stroke-order outlines for every character the course teaches.

## Source, and why this one

KanjiVG (https://kanjivg.tagaini.net/), CC BY-SA 3.0. It is the only complete
option: there is no MIT or public-domain kanji stroke-order dataset. animCJK is
Arphic Public License and is itself KanjiVG-derived; strokesvg covers kana only.

The licence obliges two things and no more:

  * credit KanjiVG wherever the strokes are shown — see `NOTICE`, and the
    credits line each client renders
  * keep the stroke data, and anything derived from it, under CC BY-SA

It is not GPL. It does not reach the application code, the lesson content, or
the audio. The share-alike lives entirely on the files this script writes.

## Only the characters we teach

Fetched per character rather than by downloading the 11,000-file archive. That
is slower, but it keeps the share-alike scope to exactly the ~300 characters the
course uses, and makes the data set auditable — every file here corresponds to
something in the database.

Yōon like きゃ are two characters and are stored as two files; a client composes
them, the same way it renders them into two manuscript cells.

## Output

  api/storage/strokes/<codepoint>.json   { char, viewBox, paths: [ "M…", … ] }

Keyed by hex codepoint because it is URL-safe and a client derives it from the
character with `codePointAt(0).toString(16)` — no id lookup, and no filename to
keep in step with anything.

Run from the repo root:

    python3 tools/fetch-stroke-order.py
    python3 tools/fetch-stroke-order.py --force   # re-fetch everything
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "api" / "storage" / "strokes"
RAW = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{code}.svg"

# KanjiVG names files by five-digit zero-padded lowercase hex codepoint.
NAME = "{:05x}"


def characters_from_db() -> list[str]:
    """Read the taught characters straight out of Mongo via `mongosh`.

    Same approach as `generate-audio.py`: this is a build tool, so it borrows the
    database driver already running in the container rather than growing one of
    its own.

    Kana are decomposed into individual characters — きゃ is two glyphs with two
    stroke orders, and KanjiVG has no entry for the pair.
    """
    script = """
      const out = new Set();
      db.kanaItems.find({}, { kana: 1 }).forEach(d => {
        for (const ch of d.kana) out.add(ch);
      });
      db.kanjiEntries.find({}, { char: 1 }).forEach(d => {
        for (const ch of d.char) out.add(ch);
      });
      print([...out].join(''));
    """
    result = subprocess.run(
        ["docker", "exec", "langapp-mongo", "mongosh", "langapp", "--quiet", "--eval", script],
        capture_output=True,
        text=True,
        check=True,
    )
    return sorted(set(result.stdout.strip()))


def strokes_from_svg(svg: str) -> tuple[str, list[str]]:
    """Pull the stroke paths out, in order, and drop everything else.

    A KanjiVG file carries two groups: the strokes, and a `StrokeNumbers` group
    of `<text>` elements that label them. Only the paths are wanted — the numbers
    are baked at a fixed size and would be unreadable scaled into a cell, and a
    client that wants them can count.

    Document order *is* stroke order in KanjiVG, which is the whole point of the
    dataset, so no sorting is needed or wanted.
    """
    root = ElementTree.fromstring(svg)
    view_box = root.get("viewBox", "0 0 109 109")

    paths: list[str] = []
    for element in root.iter():
        if not element.tag.endswith("path"):
            continue
        d = element.get("d")
        if d:
            paths.append(d)

    return view_box, paths


def fetch(char: str, force: bool) -> str:
    code = NAME.format(ord(char))
    target = OUT / f"{code}.json"

    if target.exists() and not force:
        return "skip"

    url = RAW.format(code=code)
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            svg = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            # A character KanjiVG does not have. Worth reporting rather than
            # silently writing nothing — the client's fallback is to show no
            # stroke diagram, and we should know which characters get that.
            return "missing"
        raise

    view_box, paths = strokes_from_svg(svg)
    if not paths:
        return "empty"

    target.write_text(
        json.dumps({"char": char, "viewBox": view_box, "paths": paths}, ensure_ascii=False),
        encoding="utf-8",
    )
    return "made"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="re-fetch characters already present")
    parser.add_argument("--limit", type=int, help="stop after N characters (smoke test)")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    chars = characters_from_db()
    if args.limit:
        chars = chars[: args.limit]
    print(f"{len(chars)} characters taught by the course")

    counts = {"made": 0, "skip": 0, "missing": 0, "empty": 0}
    missing: list[str] = []

    for index, char in enumerate(chars, 1):
        outcome = fetch(char, args.force)
        counts[outcome] += 1
        if outcome in ("missing", "empty"):
            missing.append(char)
        if outcome == "made":
            # Courtesy pause. This is a few hundred requests against someone
            # else's free hosting, run rarely; there is no reason to be quick.
            time.sleep(0.05)
        if index % 50 == 0:
            print(f"  {index}/{len(chars)}…")

    print(
        f"\nmade {counts['made']}, already present {counts['skip']}, "
        f"no data {counts['missing'] + counts['empty']}"
    )
    if missing:
        print("Characters with no stroke data: " + "".join(missing))
        print("Those will render without a diagram, which is the intended fallback.")

    total = sum(p.stat().st_size for p in OUT.glob("*.json"))
    print(f"{len(list(OUT.glob('*.json')))} files, {total / 1024:.0f} KB in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
