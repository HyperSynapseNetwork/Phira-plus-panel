import type { RoomBatchActionId } from '~/config/action-ids'
import type {
  ActionExecuteResult,
  AdminNotificationComposer,
  AdminRoom,
  AdminTask,
  AdminUser,
  AuditEvent,
  AuditFilter,
  CommandRun,
  ConfigDiffResult,
  ConfigFieldDescriptor,
  ConfigSnapshot,
  ConfigValue,
  Coupon,
  CouponPayload,
  Group,
  GroupPayload,
  Job,
  LogEntry,
  LogFilter,
  LogTranslation,
  NotificationDelivery,
  PermissionManifestEntry,
  PluginInfo,
  RoomActionArgs,
  RoomActionName,
  RoomActionResult,
  RoomBatchResult,
  Runbook,
  RunbookPayload,
  RunbookRun,
  ServerAction,
  ServerStatus,
  UserMultiplayer,
  UserSecurity,
  UserSession,
} from '~/types/admin'
import type { Paginated } from '~/types/api'
/**
 * Typed admin API — all calls stay inside the frozen PPB admin namespace
 * (`/api/v1/admin/*`, contracts/README §1) + a few PROPOSED sub-paths (see
 * docs/PHASE_A_PLAN.md §4b). PPB Phase B may be incomplete: every page handles
 * the resulting ApiError gracefully (no fabricated data).
 */
import { useApi } from '~/composables/useApi'

// --- Permissions -----------------------------------------------------------
export function fetchPermissionManifest(): Promise<PermissionManifestEntry[]> {
  return useApi().get('/admin/permissions/manifest')
}

// --- Groups ----------------------------------------------------------------
export function fetchGroups(params?: Record<string, unknown>): Promise<Paginated<Group>> {
  return useApi().get('/admin/groups', params)
}
export function fetchGroup(id: string): Promise<Group> {
  return useApi().get(`/admin/groups/${id}`)
}
export function createGroup(payload: GroupPayload): Promise<Group> {
  return useApi().post('/admin/groups', payload)
}
export function updateGroup(id: string, payload: Partial<GroupPayload> & { permissions?: string[] }): Promise<Group> {
  return useApi().patch(`/admin/groups/${id}`, payload)
}
export function deleteGroup(id: string): Promise<{ ok: true }> {
  return useApi().delete(`/admin/groups/${id}`)
}
export function setGroupMembers(id: string, userIds: string[]): Promise<Group> {
  return useApi().put(`/admin/groups/${id}/members`, { user_ids: userIds })
}
export function setGroupPermissions(id: string, permissions: string[]): Promise<Group> {
  return useApi().put(`/admin/groups/${id}/permissions`, { permissions })
}

// --- Users (PPB + PMP unified, §18.4) --------------------------------------
export function fetchUsers(params?: Record<string, unknown>): Promise<Paginated<AdminUser>> {
  return useApi().get('/admin/users', params)
}
export function fetchUser(id: string): Promise<AdminUser> {
  return useApi().get(`/admin/users/${id}`)
}
export function fetchUserMultiplayer(id: string): Promise<UserMultiplayer> {
  return useApi().get(`/admin/users/${id}/multiplayer`)
}
export function fetchUserSessions(id: string): Promise<UserSession[]> {
  return useApi().get(`/admin/users/${id}/sessions`)
}
export function fetchUserSecurity(id: string): Promise<UserSecurity> {
  return useApi().get(`/admin/users/${id}/security`)
}
export function fetchUserAudit(id: string, params?: Record<string, unknown>): Promise<Paginated<AuditEvent>> {
  return useApi().get(`/admin/users/${id}/audit`, params)
}
export function runUserAction(id: string, action: string, args: Record<string, unknown> = {}): Promise<ActionExecuteResult> {
  return useApi().post(`/admin/users/${id}/actions`, { action, args })
}

// --- Rooms (list/detail/actions/batch, §18.3) ------------------------------
export function fetchRooms(params?: Record<string, unknown>): Promise<Paginated<AdminRoom>> {
  return useApi().get('/admin/rooms', params)
}
/** Create a room (§18.3 Actions create / §17 `POST /rooms`). */
export function createRoom(payload: { name: string, max_users?: number }): Promise<AdminRoom> {
  return useApi().post('/admin/rooms', payload)
}
export function fetchRoom(uuid: string): Promise<AdminRoom> {
  return useApi().get(`/admin/rooms/${uuid}`)
}
export function runRoomAction(uuid: string, action: RoomActionName, args: RoomActionArgs = {}): Promise<RoomActionResult> {
  return useApi().post(`/admin/rooms/${uuid}/actions`, { action, args })
}
/**
 * Batch: only safe actions (kick / force_move / ban). PPB returns
 * `{items, succeeded, failed}` (§17); request uses `room_ids` (RoomBatchBody).
 */
export function runRoomBatchAction(
  action: RoomBatchActionId,
  roomIds: string[],
  args: RoomActionArgs = {},
  preview = false,
): Promise<RoomBatchResult> {
  return useApi().post('/admin/rooms/actions/batch', { action, room_ids: roomIds, args, preview })
}

// --- Server (status/actions/update, §18.6) ---------------------------------
export function fetchServerStatus(): Promise<ServerStatus> {
  return useApi().get('/admin/server/status')
}
export function runServerAction(action: ServerAction, args: Record<string, unknown> = {}): Promise<ActionExecuteResult> {
  return useApi().post('/admin/server/actions', { action, args })
}

// --- Config (Form Descriptor + snapshot/rollback, §20) ---------------------
export function fetchConfigDescriptors(): Promise<ConfigFieldDescriptor[]> {
  return useApi().get('/admin/config/descriptors')
}
export function fetchConfigValues(): Promise<ConfigValue> {
  return useApi().get('/admin/config/values')
}
export function validateConfig(values: ConfigValue): Promise<{ ok: boolean, errors: Array<{ path: string, message: string }> }> {
  return useApi().post('/admin/config/validate', { values })
}
export function diffConfig(values: ConfigValue): Promise<ConfigDiffResult> {
  return useApi().post('/admin/config/diff', { values })
}
export function saveConfig(values: ConfigValue): Promise<{ ok: true, snapshot_id?: string }> {
  return useApi().post('/admin/config/save', { values, snapshot: true })
}
export function fetchConfigSnapshots(): Promise<ConfigSnapshot[]> {
  return useApi().get('/admin/config/snapshots')
}
export function rollbackConfig(snapshotId: string): Promise<{ ok: true }> {
  return useApi().post('/admin/config/rollback', { snapshot_id: snapshotId })
}
export function fetchConfigRaw(): Promise<string> {
  return useApi().get('/admin/config/raw')
}
export function saveConfigRaw(raw: string): Promise<{ ok: true }> {
  // ConfigContentBody `{content}` (design §20.3) — validated before apply.
  return useApi().post('/admin/config/save', { content: raw, note: 'panel raw edit' })
}

// --- Plugins (§18.8) -------------------------------------------------------
export function fetchPlugins(): Promise<PluginInfo[]> {
  return useApi().get('/admin/plugins')
}
export function pluginAction(id: string, action: 'enable' | 'disable' | 'reload' | 'remove', args: Record<string, unknown> = {}): Promise<ActionExecuteResult> {
  return useApi().post(`/admin/plugins/${id}/${action}`, args)
}
export function callPlugin(id: string, method?: string, args: Record<string, unknown> = {}): Promise<{ ok: boolean, result?: unknown }> {
  return useApi().post(`/admin/plugins/${id}/call`, { method, args })
}

// --- Logs (live+history, §18.11) + translator (§19.2) ----------------------
export function fetchLogs(params: LogFilter & { page?: number, pageNum?: number } = {}): Promise<Paginated<LogEntry>> {
  return useApi().get('/admin/logs', params)
}
export function translateLog(input: { error_code?: string, message?: string }): Promise<LogTranslation> {
  return useApi().post('/admin/logs/translate', input)
}

// --- Console / Commands (§18.10) ------------------------------------------
export function executeCommand(command: string, reauthToken?: string): Promise<CommandRun> {
  return useApi().fetch('/admin/commands/execute', {
    method: 'POST',
    body: { command },
    headers: reauthToken ? { 'X-Reauth-Token': reauthToken } : undefined,
  })
}
export function fetchCommandHistory(scope: 'personal' | 'server' = 'personal', params?: Record<string, unknown>): Promise<Paginated<CommandRun>> {
  return useApi().get('/admin/commands', { scope, ...params })
}
/** Short-lived reauth context (P11) used for elevated console commands (§17 `POST /auth/reauth`). */
export function rootReauth(password: string): Promise<{ reauth_token: string }> {
  return useApi().post('/admin/auth/reauth', { password })
}

// --- Audit (§18.12) --------------------------------------------------------
export function fetchAudit(params: AuditFilter & { page?: number, pageNum?: number } = {}): Promise<Paginated<AuditEvent>> {
  return useApi().get('/admin/audit', params)
}
export function exportAuditCsv(params: AuditFilter = {}): Promise<string> {
  return useApi().get('/admin/audit/export.csv', { ...params })
}

// --- Jobs / Admin tasks (§9.4 / §18.14) ------------------------------------
export function fetchJobs(params?: Record<string, unknown>): Promise<Paginated<Job>> {
  return useApi().get('/admin/jobs', params)
}
/** Retry a failed job (§9.4 / §17 `POST /jobs/{job_id}/retry`). */
export function retryJob(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/jobs/${id}/retry`)
}
export function fetchAdminTasks(params?: Record<string, unknown>): Promise<Paginated<AdminTask>> {
  return useApi().get('/admin/jobs/tasks', params)
}
export function completeAdminTask(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/jobs/tasks/${id}/complete`)
}

// --- Notifications (admin composer, §18.13) --------------------------------
export function sendAdminNotification(payload: AdminNotificationComposer): Promise<{ ok: true, id: string }> {
  return useApi().post('/admin/notifications/send', payload)
}
export function fetchNotificationDelivery(params?: Record<string, unknown>): Promise<Paginated<NotificationDelivery>> {
  return useApi().get('/admin/notifications/delivery', params)
}

// --- Coupons (§18.14) ------------------------------------------------------
export function fetchCoupons(params?: Record<string, unknown>): Promise<Paginated<Coupon>> {
  return useApi().get('/admin/coupons', params)
}
export function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return useApi().post('/admin/coupons/create', payload)
}
export function revokeCoupon(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/coupons/${id}/revoke`)
}

// --- Automation / Runbooks (§10) -------------------------------------------
export function fetchRunbooks(params?: Record<string, unknown>): Promise<Paginated<Runbook>> {
  return useApi().get('/admin/automation/runbooks', params)
}
export function fetchRunbook(id: string): Promise<Runbook> {
  return useApi().get(`/admin/automation/runbooks/${id}`)
}
export function createRunbook(payload: RunbookPayload): Promise<Runbook> {
  return useApi().post('/admin/automation/runbooks', payload)
}
export function updateRunbook(id: string, payload: Partial<RunbookPayload>): Promise<Runbook> {
  return useApi().patch(`/admin/automation/runbooks/${id}`, payload)
}
export function deleteRunbook(id: string): Promise<{ ok: true }> {
  return useApi().delete(`/admin/automation/runbooks/${id}`)
}
export function runRunbook(id: string, args: Record<string, unknown> = {}): Promise<{ run_id: string }> {
  return useApi().post(`/admin/automation/runbooks/${id}/run`, { args })
}
export function fetchRunbookRuns(params?: Record<string, unknown>): Promise<Paginated<RunbookRun>> {
  return useApi().get('/admin/automation/runbook-runs', params)
}
/** Single run detail (live current_step / step_results / definition_snapshot). */
export function fetchRunbookRun(id: string): Promise<RunbookRun> {
  return useApi().get(`/admin/automation/runbook-runs/${id}`)
}
/** Cancel a run at the current step (only for cancellable steps). */
export function cancelRunbookRun(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/automation/runbook-runs/${id}/cancel`)
}
