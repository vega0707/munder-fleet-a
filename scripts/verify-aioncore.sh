#!/usr/bin/env bash
# Verify AionCore build + /health + JWT login (non-local mode).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="${AIONCORE_DIR:-$ROOT/refs/AionCore}"
DATA="${AIONCORE_DATA:-/tmp/munder-aioncore-verify}"
PORT="${AIONCORE_PORT:-25808}"
BASE="http://127.0.0.1:${PORT}"
PASS="${AIONCORE_PASSWORD:-StrongP@ss1}"

if [[ ! -d "$CORE/.git" ]]; then
  echo "AionCore missing. Run ./scripts/bootstrap-forks.sh first."
  exit 1
fi

mkdir -p "$DATA"
cd "$CORE"

if [[ ! -x "$CORE/target/debug/aioncore" && ! -x "$CORE/target/release/aioncore" ]]; then
  echo "Building aioncore (debug)…"
  cargo build --bin aioncore
fi

BIN="$CORE/target/debug/aioncore"
[[ -x "$BIN" ]] || BIN="$CORE/target/release/aioncore"

cleanup() {
  if [[ -n "${CORE_PID:-}" ]] && kill -0 "$CORE_PID" 2>/dev/null; then
    kill "$CORE_PID" 2>/dev/null || true
    wait "$CORE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

free_port() {
  if curl -sf "$BASE/health" >/dev/null 2>&1; then
    echo "Port $PORT already in use with a healthy Core — probing that instance."
    return 0
  fi
  return 1
}

echo "== local mode health =="
rm -rf "$DATA/local"
mkdir -p "$DATA/local"
"$BIN" --local --host 127.0.0.1 --port "$PORT" --data-dir "$DATA/local" \
  --managed-resources-mode bundled >"$DATA/local.log" 2>&1 &
CORE_PID=$!
for i in $(seq 1 150); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done
HEALTH=$(curl -sf "$BASE/health")
echo "$HEALTH"
node -e 'const h=JSON.parse(process.argv[1]); if(h.status!=="ok") process.exit(1)' "$HEALTH"
echo "local /health OK"
kill "$CORE_PID" 2>/dev/null || true
wait "$CORE_PID" 2>/dev/null || true
CORE_PID=
sleep 0.3

echo "== JWT login path =="
rm -rf "$DATA/web"
mkdir -p "$DATA/web"
# Bootstrap admin password via CLI (fresh data-dir)
printf '%s' "$PASS" | "$BIN" --data-dir "$DATA/web" user set-password --password-stdin

"$BIN" --host 127.0.0.1 --port "$PORT" --data-dir "$DATA/web" \
  --managed-resources-mode bundled >"$DATA/web.log" 2>&1 &
CORE_PID=$!
for i in $(seq 1 150); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done
curl -sf "$BASE/health" >/dev/null

# CSRF cookie from status
curl -sf -c "$DATA/cookies.txt" "$BASE/api/auth/status" >"$DATA/status.json"
echo "auth status: $(cat "$DATA/status.json")"

LOGIN_CODE=$(curl -s -o "$DATA/login.json" -w "%{http_code}" -b "$DATA/cookies.txt" -c "$DATA/cookies.txt" \
  -X POST "$BASE/login" \
  -H "content-type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"$PASS\"}")
echo "login HTTP $LOGIN_CODE"
cat "$DATA/login.json"
echo

if [[ "$LOGIN_CODE" != "200" ]]; then
  echo "JWT login FAILED. See $DATA/web.log"
  exit 1
fi

TOKEN=$(node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(j.token||j.accessToken||j.access_token||"")' "$DATA/login.json")
if [[ -z "$TOKEN" ]]; then
  # cookie session may be enough; verify /api/auth/user
  USER_CODE=$(curl -s -o "$DATA/user.json" -w "%{http_code}" -b "$DATA/cookies.txt" "$BASE/api/auth/user")
  echo "auth/user HTTP $USER_CODE"
  cat "$DATA/user.json"
  echo
  [[ "$USER_CODE" == "200" ]] || exit 1
else
  USER_CODE=$(curl -s -o "$DATA/user.json" -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/user")
  echo "auth/user HTTP $USER_CODE (bearer)"
  cat "$DATA/user.json"
  echo
  [[ "$USER_CODE" == "200" ]] || exit 1
fi

echo "AionCore verify OK (health + JWT)."
