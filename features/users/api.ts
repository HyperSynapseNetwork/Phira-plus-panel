import type { ActionExecuteResult, AdminUser, AuditEvent, UserDetail, UserMultiplayer, UserSecurity, UserSession } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'
import { reauthHeaders } from '~/features/common/api'

export function fetchUsers(params?: Record<string, unknown>): Promise<Paginated<AdminUser>> {
  return useApi().get('/admin/users', params)
}
/** `GET /admin/users/{phira_id}` → `{account, groups, player}` (§22). */
export function fetchUser(phiraId: number): Promise<UserDetail> {
  return useApi().get(`/admin/users/${phiraId}`)
}
export function fetchUserMultiplayer(phiraId: number): Promise<UserMultiplayer> {
  return useApi().get(`/admin/users/${phiraId}/multiplayer`)
}
export function fetchUserSessions(phiraId: number): Promise<{ items: UserSession[] }> {
  return useApi().get(`/admin/users/${phiraId}/sessions`)
}
export function fetchUserSecurity(phiraId: number): Promise<UserSecurity> {
  return useApi().get(`/admin/users/${phiraId}/security`)
}
export function fetchUserAudit(phiraId: number, params?: Record<string, unknown>): Promise<Paginated<AuditEvent>> {
  return useApi().get(`/admin/users/${phiraId}/audit`, params)
}
/** Sensitive user actions (ban / IP-ban, §23 #10) require reauth. */
export function runUserAction(phiraId: number, action: string, args: Record<string, unknown> = {}, reauthToken?: string): Promise<ActionExecuteResult> {
  return useApi().fetch(`/admin/users/${phiraId}/actions`, { method: 'POST', body: { action, args }, headers: reauthHeaders(reauthToken) })
}
