#!/usr/bin/env python3
"""Generate and verify immutable Japanese course recordings.

The API serves ``audio/<Mongo item id>.wav``. Run this after an idempotent seed so
asset names match the deployed database. The default covers both vocabulary and
kana; bare kanji are deliberately excluded because they have contextual readings.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

MONGO_CONTAINER = os.environ.get("MONGO_CONTAINER", "langapp-mongo")
MONGO_DB = os.environ.get("MONGO_DB", "langapp")


def fetch_items(collection: str) -> list[dict]:
    if collection == "kana":
        query = (
            f'JSON.stringify(db.getSiblingDB("{MONGO_DB}").kanaItems'
            '.find({}, {_id:1, kana:1}).sort({_id:1}).toArray()'
            '.map(d => ({id:d._id.toString(),kind:"kana",text:d.kana})))'
        )
    else:
        query = (
            f'JSON.stringify(db.getSiblingDB("{MONGO_DB}").vocabItems'
            '.find({}, {_id:1, lemma:1, reading:1}).sort({_id:1}).toArray()'
            '.map(d => ({id:d._id.toString(),kind:"vocab",text:d.reading||d.lemma})))'
        )
    result = subprocess.run(
        ["docker", "exec", MONGO_CONTAINER, "mongosh", "--quiet", "--eval", query],
        capture_output=True,
        text=True,
        check=True,
    )
    start = result.stdout.find("[")
    if start < 0:
        raise SystemExit(f"unexpected mongosh output: {result.stdout[:200]}")
    return json.loads(result.stdout[start:])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--voice", default="jf_alpha", help="Kokoro Japanese voice")
    parser.add_argument("--limit", type=int, default=0, help="smoke-test only: first N combined items")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--verify-only", action="store_true", help="check coverage and WAV validity without synthesis")
    parser.add_argument("--collection", choices=["all", "vocab", "kana"], default="all")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    collections = ["vocab", "kana"] if args.collection == "all" else [args.collection]
    items = [item for collection in collections for item in fetch_items(collection)]
    if args.limit:
        items = items[: args.limit]
    if len({item["id"] for item in items}) != len(items):
        raise SystemExit("duplicate content ids across audio collections")
    print(f"{len(items)} {args.collection} items to consider", flush=True)

    # Late imports keep --help usable without the local model toolchain.
    import soundfile as sf

    kokoro = g2p = np = None
    if not args.verify_only:
        import numpy as np_module
        from kokoro_onnx import Kokoro
        from misaki import ja

        model_path = Path(os.environ.get("KOKORO_MODEL", "tools/voices/kokoro-v1.0.onnx"))
        voices_path = Path(os.environ.get("KOKORO_VOICES", "tools/voices/voices-v1.0.bin"))
        for path in (model_path, voices_path):
            if not path.exists():
                raise SystemExit(f"missing {path}; follow tools/README.md")
        kokoro = Kokoro(str(model_path), str(voices_path))
        g2p = ja.JAG2P()
        np = np_module

    made = skipped = failed = 0
    manifest_files: dict[str, dict[str, object]] = {}
    for position, item in enumerate(items, start=1):
        target = out / f"{item['id']}.wav"
        try:
            if args.force or not target.exists():
                if args.verify_only:
                    raise FileNotFoundError("recording is missing")
                assert kokoro is not None and g2p is not None and np is not None
                phonemes, _ = g2p(item["text"])
                samples, rate = kokoro.create(phonemes, voice=args.voice, is_phonemes=True)
                samples = np.asarray(samples)
                if samples.size == 0 or float(np.max(np.abs(samples))) < 0.02:
                    raise RuntimeError("synthesised silence")
                temporary = target.with_suffix(".wav.tmp")
                sf.write(temporary, samples, rate, format="WAV")
                temporary.replace(target)
                made += 1
            else:
                skipped += 1

            info = sf.info(target)
            if info.frames <= 0 or info.samplerate <= 0 or info.duration <= 0:
                raise RuntimeError("invalid or silent-length WAV")
            manifest_files[target.name] = {
                "sha256": sha256(target),
                "bytes": target.stat().st_size,
                "durationSeconds": round(info.duration, 3),
                "kind": item["kind"],
                "text": item["text"],
            }
        except Exception as error:  # one bad word should identify all failures
            failed += 1
            print(f"failed {item['id']} {item['text']}: {type(error).__name__}: {error}", file=sys.stderr)
        if position % 100 == 0:
            print(f"  {made} made, {skipped} verified, {failed} failed", flush=True)

    expected = {f"{item['id']}.wav" for item in items}
    extras = sorted(path.name for path in out.glob("*.wav") if path.name not in expected)
    if extras and not args.limit and args.collection == "all":
        failed += len(extras)
        print(f"unexpected stale recordings: {', '.join(extras[:20])}", file=sys.stderr)

    if failed == 0 and not args.limit and args.collection == "all":
        manifest = {
            "format": "wav",
            "voice": args.voice,
            "generatedAt": date.today().isoformat(),
            "database": MONGO_DB,
            "files": dict(sorted(manifest_files.items())),
        }
        (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    print(f"done: {made} made, {skipped} verified, {failed} failed -> {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
