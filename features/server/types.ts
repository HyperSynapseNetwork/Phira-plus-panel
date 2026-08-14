import type { ServerActionId } from '~/config/action-ids'
/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
import type { components, PmpStatus, ServerStatusResponse } from '~/types/generated'

// The server page composes four typed endpoints instead of one giant status:
//   GET /admin/server/status  → ServerStatusResponse (ppb_version / pmp / db / metrics)
//   GET /admin/server/stats   → ServerStatsResponse (PMP counts/ports/uptime)
//   GET /admin/server/runtime → dynamic JSON (PMP runtime.status, P-90)
//   GET /admin/jobs           → Job list (update check/apply progress)
export type { PmpStatus, ServerStatusResponse }

/** `GET /admin/server/stats` → typed PMP stats (§23 #6). */
export type ServerStatsResponse = components['schemas']['ServerStatsResponse']

/** `GET /admin/server/runtime` → dynamic PMP `runtime.status` payload (P-90). */
export type ServerRuntime = Record<string, unknown>

/** `GET /admin/server/gates` → `{connections, room_creation}` (§23 #2 real gate read). */
export interface ServerGates {
  connections: boolean
  room_creation: boolean
}

export type ServerAction = ServerActionId
