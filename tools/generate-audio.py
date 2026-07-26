#!/usr/bin/env python3
"""
Pre-generate spoken audio for every seeded vocabulary word.

Run once (and again whenever the content pack grows):

    tools/tts-venv/bin/python tools/generate-audio.py --out api/storage/audio

## Why this is a script and not a runtime call

The vocabulary is a *fixed* 802 words. Synthesising on demand would mean a model
in the API process, a cold start on the first request of every word, and CPU
spent re-making a file that can never change. Generating once and serving static
files costs nothing per request and needs no model anywhere near production.

That is also why this lives in `tools/` rather than `api/src/`: the API must not
depend on a TTS runtime, and nothing here is imported by it.

## Why vocabulary only, and not kanji

A kanji has several readings and which applies depends on the word — 山 is やま
alone and サン in 火山. Speaking one of them beside a bare glyph would teach the
learner that *that* is how the character is read, which is the same falsehood the
exercise generator refuses to state when it asks for meaning rather than reading.
Words have one reading; they are what gets a voice.

## Idempotent

A word whose file already exists is skipped, so re-running after adding a unit
only synthesises the new words. Delete the directory to force a rebuild.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

MONGO_CONTAINER = "langapp-mongo"
MONGO_DB = "langapp"


def fetch_words() -> list[dict]:
    """
    Read every vocabulary item straight from the seeded database.

    Via `mongosh` in the container rather than a Python driver, so this script
    needs no database dependency of its own — it is a build tool, not a service.
    """
    script = (
        f'JSON.stringify(db.getSiblingDB("{MONGO_DB}").vocabItems'
        '.find({}, {_id:1, lemma:1, reading:1}).toArray()'
        '.map(d => ({id: d._id.toString(), lemma: d.lemma, reading: d.reading})))'
    )
    result = subprocess.run(
        ["docker", "exec", MONGO_CONTAINER, "mongosh", "--quiet", "--eval", script],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = result.stdout.strip()
    # mongosh can prepend connection noise; take the JSON array only.
    start = payload.find("[")
    if start == -1:
        raise SystemExit(f"unexpected mongosh output: {payload[:200]}")
    return json.loads(payload[start:])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="directory to write .wav files into")
    parser.add_argument("--voice", default="jf_alpha", help="Kokoro Japanese voice")
    parser.add_argument("--limit", type=int, default=0, help="stop after N words (for a smoke test)")
    parser.add_argument("--force", action="store_true", help="re-synthesise existing files")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    words = fetch_words()
    if args.limit:
        words = words[: args.limit]
    print(f"{len(words)} words to consider", flush=True)

    # Imported late so `--help` works without the model being present.
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro
    from misaki import ja

    model_path = os.environ.get("KOKORO_MODEL", "tools/voices/kokoro-v1.0.onnx")
    voices_path = os.environ.get("KOKORO_VOICES", "tools/voices/voices-v1.0.bin")
    for path in (model_path, voices_path):
        if not Path(path).exists():
            raise SystemExit(
                f"missing {path}\n"
                "Download the Kokoro ONNX model and voice bin into tools/voices/ first."
            )

    kokoro = Kokoro(model_path, voices_path)
    g2p = ja.JAG2P()

    made = skipped = failed = 0
    for word in words:
        target = out / f"{word['id']}.wav"
        if target.exists() and not args.force:
            skipped += 1
            continue

        # The *reading* is what should be spoken. For every seeded unit it is
        # identical to the lemma (the course is kana-only until kanji), but the
        # schema keeps them apart precisely so a kanji spelling can arrive later
        # without changing what the audio says.
        text = word["reading"] or word["lemma"]
        try:
            phonemes, _ = g2p(text)
            samples, rate = kokoro.create(phonemes, voice=args.voice, is_phonemes=True)
            samples = np.asarray(samples)
            # A model that returns silence is a failure that looks like success:
            # the file exists, the run reports "made", and the learner taps a mute
            # button. Cheap to check, so it is checked.
            if samples.size == 0 or float(np.max(np.abs(samples))) < 0.02:
                raise RuntimeError('synthesised silence')
            sf.write(target, samples, rate)
            made += 1
        except Exception as err:  # noqa: BLE001 - one bad word must not stop the run
            failed += 1
            print(f"  failed {text}: {type(err).__name__}: {err}", file=sys.stderr, flush=True)

        if (made + skipped) % 100 == 0:
            print(f"  {made} made, {skipped} skipped, {failed} failed", flush=True)

    print(f"done: {made} made, {skipped} skipped, {failed} failed -> {out}")
    return 1 if failed and not made else 0


if __name__ == "__main__":
    raise SystemExit(main())
