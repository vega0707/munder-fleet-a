#!/usr/bin/env bash
# Apply Fleet overlay files into a local AionCore checkout (refs/AionCore by default).
# Does NOT vendor Multica. Creates migration stub + docs for fork merge.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="${AIONCORE_DIR:-$ROOT/refs/AionCore}"
OVERLAY="$ROOT/overlays/aioncore-fleet"

if [[ ! -d "$CORE/.git" ]]; then
  echo "AionCore missing at $CORE — run ./scripts/bootstrap-forks.sh"
  exit 1
fi

mkdir -p "$CORE/crates/aionui-db/migrations"
cp -v "$OVERLAY/migrations/044_fleet_runtime_and_pending_decision.sql" \
  "$CORE/crates/aionui-db/migrations/"

mkdir -p "$CORE/docs/munder-fleet"
cp -v "$OVERLAY/README.md" "$CORE/docs/munder-fleet/FLEET_OVERLAY.md"
cp -v "$OVERLAY/FORK_POINT.md" "$CORE/docs/munder-fleet/FORK_POINT.md"

echo "Overlay applied into $CORE"
echo "Next: implement aionui-fleet crate wiring (see overlay README). P0/P1 runtime semantics currently live in munder-fleet-a src/fleet."
