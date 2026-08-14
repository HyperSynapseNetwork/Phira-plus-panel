/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
import type { GroupRef } from '~/types/generated'
import type { AuditEvent } from '~/features/audit/types'

// `ppb_user_id` (UUID) vs `phira_id` (Phira i32); avatar/username).
// ---------------------------------------------------------------------------
export interface AdminUser {
  /** PPB UUID (contract §20 ID semantics). */
  ppb_user_id: string
  /** Phira i32 — the route id for `/admin/users/{phira_id}`. */
  phira_id: number
  username: string
  avatar: string
  status: string
  created_at: string
  last_seen_at?: string | null
  updated_at: string
}

/** `GET /admin/users/{phira_id}` → `{account, groups, player}` (§23 #3). */
export interface UserDetail {
  account: AdminUser
  /** §23 #3: object array `[{id, name}]`, not string[]. */
  groups: GroupRef[]
  /** Best-effort PMP player info (dynamic payload; null when PMP offline). */
  player?: unknown
}

/** `GET /admin/users/{phira_id}/multiplayer` (§23 #5, strong-typed). */
export interface UserMultiplayer {
  phira_id: number
  online: boolean
  ban_state: boolean
  current_room?: string | null
  playtime_secs?: number | null
  replay_count?: number | null
  rounds_played?: number | null
}

/** `GET /admin/users/{phira_id}/sessions` item (§23 #5, SessionItem). */
export interface UserSession {
  id: string
  client_type: string
  created_at: string
  device_name: string
  ip: string
  revoked_at?: string | null
}

/** `GET /admin/users/{phira_id}/security` (§23 #5, strong-typed). */
export interface UserSecurity {
  phira_id: number
  ban_state: boolean
  ban_reason?: string | null
  banned_at?: unknown
  ip_bans?: unknown
  ip_history: unknown[]
}

export interface UserAuditSummary {
  total: number
  events: AuditEvent[]
}
