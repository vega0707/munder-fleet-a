#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY="${SCRIPT_DIR}/overlay"
TARGET="${1:-}"

if [[ -z "${TARGET}" ]]; then
  if [[ -f "${SCRIPT_DIR}/../../munder-fleet-b-work/README.md" ]]; then
    TARGET="$(cd "${SCRIPT_DIR}/../../munder-fleet-b-work" && pwd)"
  else
    echo "用法: $0 <munder-fleet-b 仓库根目录>" >&2
    exit 1
  fi
fi

if [[ ! -f "${TARGET}/README.md" ]] || ! grep -q "munder-fleet-b" "${TARGET}/README.md" 2>/dev/null; then
  echo "目标目录不像 munder-fleet-b 根目录: ${TARGET}" >&2
  exit 1
fi

echo "Applying overlay → ${TARGET}"
cp -r "${OVERLAY}/." "${TARGET}/"
echo "Done. Review diff and commit in munder-fleet-b."
