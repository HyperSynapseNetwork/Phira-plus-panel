#!/usr/bin/env bash
#
# Regenerate types/generated.ts from the PPB OpenAPI contract.
#
# Source of truth: PPB's openapi-typescript output (contracts/README §20,
# snake_case). Run this after any PPB contract change to re-sync the Panel:
#
#     ./scripts/gen-types.sh
#
# The generated file is authoritative where it overlaps hand-written panel
# types; hand-written types defer to it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PPB_TYPES="${PPB_TYPES:-$REPO_ROOT/../ppb/contracts/types.ts}"
DEST="$REPO_ROOT/types/generated.ts"

if [ ! -f "$PPB_TYPES" ]; then
  echo "error: PPB types not found at $PPB_TYPES (override with PPB_TYPES=...)" >&2
  exit 1
fi

{
  echo '/**'
  echo ' * GENERATED — do not edit by hand.'
  echo ' *'
  echo ' * Auto-generated from the PPB OpenAPI contract via openapi-typescript'
  echo ' * (contracts/README.md §20, snake_case). Regenerate after a PPB contract'
  echo ' * change by running:  ./scripts/gen-types.sh'
  echo ' *'
  echo ' * Hand-written panel types (types/api.ts, types/admin.ts) defer to these'
  echo ' * where they overlap; the generated file is the contract authority.'
  echo ' */'
  echo '/* eslint-disable */'
  echo '// @ts-nocheck'
  cat "$PPB_TYPES"
} > "$DEST"

echo "updated $DEST"
