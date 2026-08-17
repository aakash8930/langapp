#!/usr/bin/env bash
# Non-destructive public-MVP release checks.
# Usage: API_URL=https://example.com/api WEB_URL=https://example.com/learn ./scripts/release-preflight.sh
set -Eeuo pipefail

: "${API_URL:?Set API_URL to the public API base URL (without a trailing slash)}"
: "${WEB_URL:?Set WEB_URL to the public web base URL (without a trailing slash)}"

API_URL=${API_URL%/}
WEB_URL=${WEB_URL%/}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

WEB_ORIGIN=${WEB_ORIGIN:-$(python3 - "$WEB_URL" <<'PY'
from urllib.parse import urlsplit
import sys
u = urlsplit(sys.argv[1])
print(f"{u.scheme}://{u.netloc}")
PY
)}

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1" >&2; exit 1; }

get_json() {
  local name=$1 url=$2 output=$3
  local code
  code=$(curl --fail-with-body --silent --show-error --location \
    --connect-timeout 10 --max-time 30 --output "$output" --write-out '%{http_code}' "$url") \
    || fail "$name request failed: $url"
  [[ "$code" == 2* ]] || fail "$name returned HTTP $code"
}

printf 'GENKŌ public MVP preflight\nAPI: %s\nWeb: %s\nOrigin: %s\n\n' "$API_URL" "$WEB_URL" "$WEB_ORIGIN"

get_json health "$API_URL/health" "$WORK/health.json"
python3 - "$WORK/health.json" <<'PY' || fail 'health is not healthy'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    body = json.load(f)
if body.get('status') != 'ok':
    raise SystemExit(f"health status is {body.get('status')!r}: {body}")
PY
pass 'API health (including configured dependencies)'

get_json lessons "$API_URL/v1/lessons" "$WORK/lessons.json"
python3 - "$WORK/lessons.json" <<'PY' || fail 'course catalog is empty or invalid'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    body = json.load(f)
if not isinstance(body, list) or not body:
    raise SystemExit('expected a non-empty lesson array')
PY
pass 'seeded lesson catalog'

get_json terms "$API_URL/v1/legal/terms" "$WORK/terms.json"
get_json privacy "$API_URL/v1/legal/privacy" "$WORK/privacy.json"
pass 'canonical Terms and Privacy documents'

curl --fail-with-body --silent --show-error --location \
  --connect-timeout 10 --max-time 30 --output "$WORK/web.html" "$WEB_URL/" \
  || fail 'web application request failed'
grep -q 'GENKŌ' "$WORK/web.html" || fail 'web response does not contain the GENKŌ brand'
pass 'web application entry document'

curl --silent --show-error --dump-header "$WORK/cors.headers" --output /dev/null \
  --connect-timeout 10 --max-time 30 \
  -H "Origin: $WEB_ORIGIN" "$API_URL/v1/lessons" \
  || fail 'browser-origin CORS probe failed'
allowed_origin=$(awk 'tolower($0) ~ /^access-control-allow-origin:/ { sub(/^[^:]*:[[:space:]]*/, ""); print; exit }' \
  "$WORK/cors.headers" | tr -d '\r')
[[ "$allowed_origin" == "$WEB_ORIGIN" ]] \
  || fail "API did not allow browser origin $WEB_ORIGIN (returned ${allowed_origin:-no header})"
pass 'credentialed browser origin allowlist'

printf '\nPreflight passed. Continue with RELEASE-CHECKLIST.md; this script does not send mail or mutate learner data.\n'
