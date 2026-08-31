#!/usr/bin/env bash
# Apply Fleet overlay into vendored AionCore at core/ (monorepo default).
# Override with AIONCORE_DIR for a temporary checkout under refs/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="${AIONCORE_DIR:-$ROOT/core}"
OVERLAY="$ROOT/overlays/aioncore-fleet"

if [[ ! -f "$CORE/Cargo.toml" ]]; then
  echo "AionCore tree missing at $CORE — run ./scripts/sync-core.sh"
  exit 1
fi

mkdir -p "$CORE/crates/aionui-db/migrations" "$CORE/docs/munder-fleet"
cp -v "$OVERLAY/migrations/044_fleet_runtime_and_pending_decision.sql" \
  "$CORE/crates/aionui-db/migrations/"
cp -v "$OVERLAY/README.md" "$CORE/docs/munder-fleet/FLEET_OVERLAY.md"
cp -v "$OVERLAY/FORK_POINT.md" "$CORE/docs/munder-fleet/FORK_POINT.md"

echo "Overlay applied into $CORE"
echo "Next: implement aionui-fleet routes inside core/ (see overlays/aioncore-fleet/README.md)."
