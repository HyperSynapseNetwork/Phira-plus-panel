import type { Group, GroupPayload } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'
import { reauthHeaders } from '~/features/common/api'

export function fetchGroups(params?: Record<string, unknown>): Promise<Paginated<Group>> {
  return useApi().get('/admin/groups', params)
}
export function fetchGroup(id: string): Promise<Group> {
  return useApi().get(`/admin/groups/${id}`)
}
export function createGroup(payload: GroupPayload): Promise<Group> {
  return useApi().post('/admin/groups', payload)
}
export function updateGroup(id: string, payload: Partial<GroupPayload> & { permissions?: string[] }, reauthToken?: string): Promise<Group> {
  return useApi().fetch(`/admin/groups/${id}`, { method: 'PATCH', body: payload, headers: reauthHeaders(reauthToken) })
}
export function deleteGroup(id: string): Promise<{ ok: true }> {
  return useApi().delete(`/admin/groups/${id}`)
}
export function setGroupMembers(id: string, userIds: string[], reauthToken?: string): Promise<Group> {
  return useApi().fetch(`/admin/groups/${id}/members`, { method: 'PUT', body: { user_ids: userIds }, headers: reauthHeaders(reauthToken) })
}
export function setGroupPermissions(id: string, permissions: string[], reauthToken?: string): Promise<Group> {
  return useApi().fetch(`/admin/groups/${id}/permissions`, { method: 'PUT', body: { permissions }, headers: reauthHeaders(reauthToken) })
}
