import type { ActionExecuteResult, ServerAction, ServerGates, ServerRuntime, ServerStatsResponse, ServerStatusResponse } from '~/types/admin'
import { useApi } from '~/composables/useApi'
import { reauthHeaders } from '~/features/common/api'

export function fetchServerStatus(): Promise<ServerStatusResponse> {
  return useApi().get('/admin/server/status')
}
/** `GET /admin/server/stats` → typed PMP stats (§23 #6). */
export function fetchServerStats(): Promise<ServerStatsResponse> {
  return useApi().get('/admin/server/stats')
}
/** `GET /admin/server/runtime` → dynamic PMP runtime.status payload (P-90). */
export function fetchServerRuntime(): Promise<ServerRuntime> {
  return useApi().get('/admin/server/runtime')
}
export function runServerAction(action: ServerAction, args: Record<string, unknown> = {}, reauthToken?: string): Promise<ActionExecuteResult> {
  return useApi().fetch('/admin/server/actions', { method: 'POST', body: { action, args }, headers: reauthHeaders(reauthToken) })
}
/** `GET /admin/server/gates` → typed `{connections, room_creation}` (§23 #2). */
export function fetchServerGates(): Promise<ServerGates> {
  return useApi().get('/admin/server/gates')
}
