#!/usr/bin/env bash
# Sync / refresh vendored AionCore under core/ from upstream pin in docs/VERSIONS.md.
# Does not vendor Multica. Requires network.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIN="${AIONCORE_PIN:-9bfb2adbab1aca47bcd1a644446aeee6c41aab4f}"
URL="${AIONCORE_URL:-https://github.com/iOfficeAI/AionCore.git}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Cloning AionCore @ ${PIN} …"
git clone --depth 1 "$URL" "$TMP/AionCore"
# depth-1 may not have pin if not tip — fetch pin explicitly
git -C "$TMP/AionCore" fetch --depth 1 origin "$PIN" || git -C "$TMP/AionCore" fetch --depth 1 origin "$PIN"
git -C "$TMP/AionCore" checkout "$PIN" 2>/dev/null || {
  # shallow may fail; deepen
  git -C "$TMP/AionCore" fetch --depth 50 origin
  git -C "$TMP/AionCore" checkout "$PIN"
}

rm -rf "$ROOT/core"
mkdir -p "$ROOT/core"
cp -a "$TMP/AionCore/." "$ROOT/core/"
rm -rf "$ROOT/core/.git" "$ROOT/core/target"

if ! grep -q '^/target' "$ROOT/core/.gitignore" 2>/dev/null; then
  echo '/target' >> "$ROOT/core/.gitignore"
fi

# Re-apply fleet overlay
"$ROOT/scripts/apply-fleet-overlay.sh"

# Refresh notice
cat > "$ROOT/core/MUNDER_FORK_NOTICE.md" << EOF
# AionCore inside munder-fleet-a

Vendored from [iOfficeAI/AionCore](https://github.com/iOfficeAI/AionCore)
at pin **\`${PIN}\`** (see \`docs/VERSIONS.md\`).

- License: **Apache-2.0** — see \`LICENSE\`; retain NOTICE/版权.
- Monorepo layout: Control/Runtime plane lives under \`core/\`.
- Fleet overlay applied via \`scripts/apply-fleet-overlay.sh\`.
- Do **not** vendor Multica source here.

Refresh: \`./scripts/sync-core.sh\`
EOF

echo "core/ refreshed @ ${PIN}"
