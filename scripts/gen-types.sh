#!/usr/bin/env bash
# Sync the complete frozen PPB contract into Panel.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_PPB_ROOT="$(cd "$REPO_ROOT/../../ppb/Phira-plus-Backend-main" 2>/dev/null && pwd || true)"
PPB_TYPES="${PPB_TYPES:-${DEFAULT_PPB_ROOT:+$DEFAULT_PPB_ROOT/contracts/types.ts}}"
if [[ -z "$PPB_TYPES" || ! -f "$PPB_TYPES" ]]; then
  echo "error: PPB contracts/types.ts not found (override with PPB_TYPES=...)" >&2
  exit 1
fi
PPB_CONTRACTS="$(cd "$(dirname "$PPB_TYPES")" && pwd)"
DEST="$REPO_ROOT/types/generated.ts"
{
  cat <<'HEADER'
/**
 * GENERATED — complete frozen PPB OpenAPI TypeScript mirror.
 * Do not hand-edit. Regenerate via scripts/gen-types.sh after PPB contract changes.
 */
/* eslint-disable */
// @ts-nocheck
HEADER
  cat <<'ALIASES'
export type AdminUserItem = components['schemas']['AdminUserItem']
export type AppNotificationWire = components['schemas']['AppNotificationWire']
export type AuditEvent = components['schemas']['AuditEvent']
export type AuditListResponse = components['schemas']['AuditListResponse']
export type ConfigValidationError = components['schemas']['ConfigValidationError']
export type ErrorBody = components['schemas']['ErrorBody']
export type ErrorEnvelope = components['schemas']['ErrorEnvelope']
export type Job = components['schemas']['Job']
export type MeResponse = components['schemas']['MeResponse']
export type ServerStatusResponse = components['schemas']['ServerStatusResponse']
ALIASES
  cat "$PPB_TYPES"
} > "$DEST"
cp "$PPB_CONTRACTS/openapi.json" "$REPO_ROOT/contracts/openapi.json"
cp "$PPB_CONTRACTS/error-codes.json" "$REPO_ROOT/contracts/error-codes.json"
cp "$PPB_CONTRACTS/contract-version.json" "$REPO_ROOT/contracts/contract-version.json"
echo "✓ synced complete contract types/openapi/error-codes/version -> Panel"
