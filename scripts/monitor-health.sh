#!/usr/bin/env bash
# Poll the public health endpoint and notify once per state transition.
set -Eeuo pipefail

: "${HEALTH_URL:?Set HEALTH_URL to the public /health URL}"
: "${ALERT_WEBHOOK_URL:?Set ALERT_WEBHOOK_URL to an operations-owned webhook}"

STATE_FILE=${LANGAPP_MONITOR_STATE_FILE:-${XDG_STATE_HOME:-$HOME/.local/state}/genko/health-state}
mkdir -p "$(dirname "$STATE_FILE")"
previous=$(cat "$STATE_FILE" 2>/dev/null || printf unknown)
body=$(mktemp)
trap 'rm -f "$body"' EXIT

if ! code=$(curl --silent --show-error --location --connect-timeout 10 --max-time 30 \
  --output "$body" --write-out '%{http_code}' "$HEALTH_URL" 2>/dev/null); then
  code=000
fi

state=down
if [[ "$code" == 200 ]] && python3 - "$body" <<'PY' >/dev/null 2>&1
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    raise SystemExit(0 if json.load(f).get('status') == 'ok' else 1)
PY
then
  state=up
fi

if [[ "$state" != "$previous" ]]; then
  summary="GENKŌ health changed: ${previous} -> ${state} (HTTP ${code})"
  payload=$(python3 - "$summary" "$HEALTH_URL" <<'PY'
import json, sys
print(json.dumps({'text': sys.argv[1], 'healthUrl': sys.argv[2]}))
PY
)
  curl --fail-with-body --silent --show-error --connect-timeout 10 --max-time 30 \
    -H 'Content-Type: application/json' --data "$payload" "$ALERT_WEBHOOK_URL" >/dev/null
fi

printf '%s' "$state" >"$STATE_FILE"
printf '%s — %s (HTTP %s)\n' "$(date -u +%FT%TZ)" "$state" "$code"
[[ "$state" == up ]]
