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
  cat <<'ALIASES'
// Top-level aliases for the generated schemas — openapi-typescript only
// exports `paths`/`components`/`operations`; these give consumers a stable
// import surface (components['schemas']['X'] → X).
export type AdminUserItem = components['schemas']['AdminUserItem']
export type AppNotificationWire = components['schemas']['AppNotificationWire']
export type AuditEvent = components['schemas']['AuditEvent']
export type AuditListResponse = components['schemas']['AuditListResponse']
export type ChatSendBody = components['schemas']['ChatSendBody']
export type ConfigFieldDescriptor = components['schemas']['ConfigFieldDescriptor']
export type ConfigFieldGroup = components['schemas']['ConfigFieldGroup']
export type ConfigSnapshot = components['schemas']['ConfigSnapshot']
export type ConfigValidationError = components['schemas']['ConfigValidationError']
export type ConfigValuesBody = components['schemas']['ConfigValuesBody']
export type ErrorBody = components['schemas']['ErrorBody']
export type ErrorEnvelope = components['schemas']['ErrorEnvelope']
export type Group = components['schemas']['Group']
export type GroupListItem = components['schemas']['GroupListItem']
export type GroupListResponse = components['schemas']['GroupListResponse']
export type GroupRef = components['schemas']['GroupRef']
export type Job = components['schemas']['Job']
export type MeResponse = components['schemas']['MeResponse']
export type PaginationResponse = components['schemas']['PaginationResponse']
export type PhiraLoginRequest = components['schemas']['PhiraLoginRequest']
export type PmpStatus = components['schemas']['PmpStatus']
export type ReauthRequest = components['schemas']['ReauthRequest']
export type ReplayDetail = components['schemas']['ReplayDetail']
export type ReplayManifest = components['schemas']['ReplayManifest']
export type RoomActionBody2 = components['schemas']['RoomActionBody2']
export type RoomActionRequest = components['schemas']['RoomActionRequest']
export type SendBody = components['schemas']['SendBody']
export type ServerStatusResponse = components['schemas']['ServerStatusResponse']
export type SessionItem = components['schemas']['SessionItem']
export type TranslatedError = components['schemas']['TranslatedError']
export type TranslateParams = components['schemas']['TranslateParams']
export type TranslateResponse = components['schemas']['TranslateResponse']
export type UserDetailResponse = components['schemas']['UserDetailResponse']
export type UserListResponse = components['schemas']['UserListResponse']
export type UserMultiplayerResponse = components['schemas']['UserMultiplayerResponse']
export type UserSecurityResponse = components['schemas']['UserSecurityResponse']
export type UserSessionsResponse = components['schemas']['UserSessionsResponse']
ALIASES
  cat "$PPB_TYPES"
} > "$DEST"

echo "updated $DEST"
