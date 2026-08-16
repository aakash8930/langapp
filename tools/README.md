# Japanese audio toolchain

GENKŌ uses three audio layers:

1. **Pre-generated course recordings** for kana and vocabulary, served as immutable WAV files.
2. **Japanese system-voice fallback** in web and Expo when a recording is missing or unreachable.
3. **Spoken AI tutor replies** using the browser/device Japanese voice. Only the Japanese portion of a bilingual reply is spoken.

Bare kanji are not voiced because their reading depends on the word in which they appear.

## Local generator setup

```bash
python3 -m venv tools/tts-venv
tools/tts-venv/bin/pip install kokoro-onnx "misaki[ja]" soundfile
tools/tts-venv/bin/python -m unidic download
mkdir -p tools/voices
cd tools/voices
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
curl -L -O $BASE/kokoro-v1.0.onnx
curl -L -O $BASE/voices-v1.0.bin
```

The venv, dictionary, and model weights are downloaded tooling and are intentionally ignored by Git.

## Generate and verify

Seed the exact database that will serve the files, then run:

```bash
# Quick model smoke test
tools/tts-venv/bin/python tools/generate-audio.py \
  --out /tmp/genko-audio-smoke --limit 3

# Complete vocabulary + kana pack, with coverage/hash manifest
tools/tts-venv/bin/python tools/generate-audio.py \
  --out api/storage/audio

# Release check without synthesising anything
tools/tts-venv/bin/python tools/generate-audio.py \
  --out api/storage/audio --verify-only
```

The default command covers both collections, validates every WAV, rejects stale files, and writes `manifest.json` only after complete success. It is idempotent; use `--force` to replace an existing voice. Any missing, malformed, silent-length, or stale recording makes the command fail.

Asset names use Mongo item IDs, so generation must happen after the idempotent production seed. This allows the API to serve a file without a database lookup and keeps each URL immutable.

## Deployment

`api/storage/audio` is runtime storage and is not committed. Generate on the deployment host or copy the complete directory, including `manifest.json`, without replacing a verified pack piecemeal. Then run `--verify-only` against the deployed database and smoke one public URL:

```bash
curl -fsSI https://<host>/langapp/content/vocab/<id>/audio | head -1
```

Missing recordings no longer create dead controls: clients fall back to a labelled Japanese system voice. The generated pack is still preferred because it gives learners a consistent voice and can be cached for one year.
