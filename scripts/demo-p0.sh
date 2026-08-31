#!/usr/bin/env bash
# P0 demo: bootstrap → task → claim → start → complete → report to michael
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${FLEET_PORT:-3847}"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  if [[ -n "${FLEET_PID:-}" ]] && kill -0 "$FLEET_PID" 2>/dev/null; then
    kill "$FLEET_PID" 2>/dev/null || true
    wait "$FLEET_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT"
node --experimental-strip-types src/fleet/cli.ts --port "$PORT" --mode loopback &
FLEET_PID=$!

for i in $(seq 1 50); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done
curl -sf "$BASE/health" >/dev/null

echo "== bootstrap =="
curl -sf "$BASE/api/fleet/bootstrap" | tee /tmp/fleet-bootstrap.json
echo

echo "== create project =="
PROJECT=$(curl -sf -X POST "$BASE/api/fleet/projects" \
  -H 'content-type: application/json' \
  -d '{"name":"P0 Demo"}')
echo "$PROJECT"
PROJECT_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$PROJECT")

echo "== create task =="
TASK=$(curl -sf -X POST "$BASE/api/fleet/tasks" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"title\":\"Claim spike\",\"assignee\":\"vega\",\"prompt\":\"do the thing\"}")
echo "$TASK"
TASK_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$TASK")

echo "== claim =="
CLAIMED=$(curl -sf -X POST "$BASE/api/fleet/tasks/claim" \
  -H 'content-type: application/json' \
  -d '{"runtimeId":"runtime:local","maxTasks":1}')
echo "$CLAIMED"

echo "== start =="
curl -sf -X POST "$BASE/api/fleet/tasks/${TASK_ID}/start" | tee /tmp/fleet-start.json
echo

echo "== complete =="
DONE=$(curl -sf -X POST "$BASE/api/fleet/tasks/${TASK_ID}/complete" \
  -H 'content-type: application/json' \
  -d '{"output":"spike complete","reportTo":"michael"}')
echo "$DONE"

node -e '
const d = JSON.parse(process.argv[1]);
if (d.status !== "done" || d.reportedTo !== "michael") {
  console.error("DoD failed", d);
  process.exit(1);
}
console.log("P0 claim→complete DoD OK");
' "$DONE"
