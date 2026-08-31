#!/usr/bin/env bash
# Full demo: persist DB + claim-and-work (subprocess) + Michael inbox
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${FLEET_PORT:-3847}"
BASE="http://127.0.0.1:${PORT}"
DB="${FLEET_DB:-/tmp/munder-fleet-demo.db}"
rm -f "$DB"

cleanup() {
  if [[ -n "${FLEET_PID:-}" ]] && kill -0 "$FLEET_PID" 2>/dev/null; then
    kill "$FLEET_PID" 2>/dev/null || true
    wait "$FLEET_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT"
node --experimental-strip-types src/fleet/cli.ts --port "$PORT" --mode loopback --db "$DB" &
FLEET_PID=$!

for i in $(seq 1 50); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done

echo "== bootstrap =="
curl -sf "$BASE/api/fleet/bootstrap" | tee /tmp/fleet-bootstrap.json
echo

PROJECT=$(curl -sf -X POST "$BASE/api/fleet/projects" \
  -H 'content-type: application/json' \
  -d '{"name":"Full Demo"}')
PROJECT_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$PROJECT")

# Second runtime (P2)
curl -sf -X POST "$BASE/api/fleet/runtimes/register" \
  -H 'content-type: application/json' \
  -d '{"id":"runtime:peer","host":"peer-host","ownerId":"peer-owner","daemonId":"peer","maxConcurrentTasks":1,"clis":[{"provider":"codex"}]}' >/dev/null
curl -sf -X POST "$BASE/api/fleet/runtimes/runtime%3Apeer/heartbeat" >/dev/null

TASK=$(curl -sf -X POST "$BASE/api/fleet/tasks" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"title\":\"Work spike\",\"assignee\":\"vega\",\"prompt\":\"do the thing\"}")
TASK_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$TASK")

echo "== claim-and-work =="
DONE=$(curl -sf -X POST "$BASE/api/fleet/tasks/claim-and-work" \
  -H 'content-type: application/json' \
  -d '{"runtimeId":"runtime:local","maxTasks":1}')
echo "$DONE"

echo "== michael inbox =="
curl -sf "$BASE/api/fleet/michael/inbox" | tee /tmp/fleet-inbox.json
echo

echo "== hive import =="
curl -sf -X POST "$BASE/api/fleet/import/hive" \
  -H 'content-type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"tasks\":[{\"id\":\"hive-imported\",\"title\":\"Imported\",\"assignee\":\"bob\",\"status\":\"todo\",\"priority\":1}]}"
echo

echo "== persistence reopen =="
kill "$FLEET_PID" 2>/dev/null || true
wait "$FLEET_PID" 2>/dev/null || true
FLEET_PID=
node --experimental-strip-types src/fleet/cli.ts --port "$PORT" --mode loopback --db "$DB" &
FLEET_PID=$!
for i in $(seq 1 50); do
  if curl -sf "$BASE/health" >/dev/null; then break; fi
  sleep 0.1
done
TASKS=$(curl -sf "$BASE/api/fleet/tasks")
node -e '
const done=JSON.parse(process.argv[1]);
const tasks=JSON.parse(process.argv[2]);
const taskId=process.argv[3];
if(!done.tasks?.[0] || done.tasks[0].status!=="done" || done.tasks[0].reportedTo!=="michael") process.exit(1);
if(!String(done.tasks[0].result||"").includes("munder-worker")) process.exit(2);
if(!tasks.tasks.some(t=>t.id==="hive-imported")) process.exit(3);
if(!tasks.tasks.some(t=>t.id===taskId && t.status==="done")) process.exit(4);
console.log("FULL DoD OK (work+persist+hive+michael)");
' "$DONE" "$TASKS" "$TASK_ID"
