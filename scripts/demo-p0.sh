#!/usr/bin/env bash
# P0 demo: bootstrap → task → claim → start → complete → report to michael
# Prefer scripts/demo-full.sh for worker+persist+hive.
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
node --experimental-strip-types src/fleet/cli.ts --port "$PORT" --mode loopback --db "" &
FLEET_PID=$!

for i in $(seq 1 50); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done

PROJECT=$(curl -sf -X POST "$BASE/api/fleet/projects" \
  -H 'content-type: application/json' \
  -d '{"name":"P0 Demo"}')
PROJECT_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$PROJECT")

TASK=$(curl -sf -X POST "$BASE/api/fleet/tasks" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"title\":\"Claim spike\",\"assignee\":\"vega\",\"prompt\":\"do the thing\"}")
TASK_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$TASK")

DONE=$(curl -sf -X POST "$BASE/api/fleet/tasks/claim-and-work" \
  -H 'content-type: application/json' \
  -d '{"runtimeId":"runtime:local","maxTasks":1}')
echo "$DONE"

node -e '
const d = JSON.parse(process.argv[1]);
if (d.tasks[0].status !== "done" || d.tasks[0].reportedTo !== "michael") {
  console.error("DoD failed", d);
  process.exit(1);
}
if (!String(d.tasks[0].result||"").includes("munder-worker")) process.exit(2);
console.log("P0 claim→work→complete DoD OK");
' "$DONE"
