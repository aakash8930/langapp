# tools/ — the local text-to-speech toolchain

Generates spoken audio for the seeded vocabulary, **once**, as static files.
Nothing here runs in production and nothing in `api/` imports it.

## Why a build tool and not a runtime dependency

The vocabulary is a fixed 802 words. Synthesising on demand would put a model in
the API process, add a cold start to the first request for every word, and spend
CPU re-making a file that can never change. Generating once and serving static
files costs nothing per request and keeps the TTS runtime off the server
entirely — which matters here, because the server is a laptop.

## Why Kokoro, after two wrong turns

Both are worth recording, because the first was a recommendation made on bad
information and the second is a trap anyone would fall into.

**Piper does not support Japanese.** It is the usual recommendation for
self-hosted TTS and several 2026 round-ups claim Japanese support, but its voice
index has 170 voices across 55 languages and **none of them is `ja`**. Verified
against `voices.json` directly rather than the articles. `piper-tts` is still in
the venv because it pulled in `onnxruntime`, which is what made the next step
cheap.

**Kokoro pulls PyTorch; `kokoro-onnx` does not.** The `kokoro` package brings
torch and several GB with it. `kokoro-onnx` runs the same model on the
`onnxruntime` that was already installed. If you are ever tempted to `pip install
kokoro`, this is why not.

**`misaki[ja]` needs full `unidic`, not `unidic-lite`.** The lite dictionary
installs cleanly and then MeCab fails at runtime looking for
`unidic/dicdir/mecabrc`. `python -m unidic download` is the fix, and it is a
~250MB download of its own.

## Setup

```bash
python3 -m venv tools/tts-venv
tools/tts-venv/bin/pip install kokoro-onnx "misaki[ja]" soundfile
tools/tts-venv/bin/python -m unidic download      # ~250MB, needed by misaki[ja]

mkdir -p tools/voices && cd tools/voices
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
curl -L -O $BASE/kokoro-v1.0.onnx                 # 311MB
curl -L -O $BASE/voices-v1.0.bin                  # 27MB
```

Roughly **900MB** on disk all told. `tools/tts-venv/` and `tools/voices/` are
gitignored — they are downloaded weights and a machine-specific virtualenv, not
source.

## Generating

```bash
# Smoke test first — three words, so a broken voice is found in seconds.
tools/tts-venv/bin/python tools/generate-audio.py --out /tmp/audio-test --limit 3

# The real run, into the API's local object storage.
tools/tts-venv/bin/python tools/generate-audio.py --out api/storage/audio
```

The script reads words straight from the seeded database via `mongosh` in the
container, so it needs no database driver of its own. It **skips words whose file
already exists**, so re-running after adding a content unit only synthesises the
new ones. `--force` rebuilds everything.

## Vocabulary only — kanji deliberately get no audio

A kanji has several readings and which one applies depends on the word: 山 is
やま alone and サン in 火山. Speaking one of them beside a bare glyph would teach
the learner that *that* is how the character is read — the same falsehood the
exercise generator refuses to state when it asks for a kanji's meaning rather
than its reading (see the Social/Exercises notes in the root `CLAUDE.md`).

Words have one reading. They are what gets a voice.

The script speaks `reading`, not `lemma`. They are identical for every seeded
unit today, because the course is kana-only until kanji — but the schema keeps
them apart precisely so a kanji spelling can arrive on `lemma` later without
changing what the audio says.
