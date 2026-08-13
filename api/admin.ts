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
  ConfigDescriptorsResponse,
  ConfigDiffResult,
  ConfigSnapshot,
  ConfigValidationResult,
  ConfigValue,
  ConfigValuesResponse,
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
  ServerGates,
  ServerRuntime,
  ServerStatsResponse,
  ServerStatusResponse,
  UserDetail,
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

/** §23 #10 sensitive-action policy: elevated writes carry `X-Reauth-Token`. */
function reauthHeaders(token?: string): Record<string, string> | undefined {
  return token ? { 'X-Reauth-Token': token } : undefined
}

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

// --- Users (PPB + PMP unified, §18.4) --------------------------------------
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

// --- Server (status/stats/runtime/actions/gates, §18.6 / §23 #6) -----------
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
/**
 * Read server gate state. Connection gate uses `server.connections` with no
 * `enabled` (backend read path, §23 #2) and parses the CLI output best-effort;
 * room-creation has no read endpoint yet (PPB gap) → always `null`.
 */
export async function fetchServerGates(): Promise<ServerGates> {
  let connections: boolean | null = null
  try {
    const res = await runServerAction('server.connections') as unknown as { output?: unknown }
    const text = Array.isArray(res.output) ? res.output.map(String).join(' ') : String(res.output ?? '')
    if (/已关闭|已禁用|\boff\b|disabled/i.test(text))
      connections = false
    else if (/已开启|已启用|\bon\b|enabled/i.test(text))
      connections = true
  }
  catch {
    connections = null
  }
  return { connections, room_creation: null }
}

// --- Config (Form Descriptor model A + snapshot/rollback, §20/§22) ---------
export function fetchConfigDescriptors(): Promise<ConfigDescriptorsResponse> {
  return useApi().get('/admin/config/descriptors')
}
export function fetchConfigValues(): Promise<ConfigValuesResponse> {
  return useApi().get('/admin/config/values')
}
export function validateConfig(values: ConfigValue): Promise<ConfigValidationResult> {
  return useApi().post('/admin/config/validate', { values })
}
export function diffConfig(values: ConfigValue): Promise<ConfigDiffResult> {
  return useApi().post('/admin/config/diff', { values })
}
/** Save form values (§22 model A): PPB validates / generates YAML / snapshots. */
export function saveConfig(values: ConfigValue): Promise<{ ok: boolean, snapshot_id?: string }> {
  return useApi().post('/admin/config/save', { values })
}
export function fetchConfigSnapshots(): Promise<{ items: ConfigSnapshot[] }> {
  return useApi().get('/admin/config/snapshots')
}
export function rollbackConfig(snapshotId: string, reauthToken?: string): Promise<{ ok: true }> {
  return useApi().fetch('/admin/config/rollback', { method: 'POST', body: { snapshot_id: snapshotId }, headers: reauthHeaders(reauthToken) })
}
/** Raw YAML view (read-only advanced entry, §20.3). */
export function fetchConfigRaw(): Promise<string> {
  return useApi().get('/admin/config/raw')
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
/** §23 P-91: request `{code}`; response `{code, translated: {...} | null}`. */
export function translateLog(code: string): Promise<LogTranslation> {
  return useApi().post('/admin/logs/translate', { code })
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
/** `GET /admin/jobs/{job_id}` — single job detail (§9.4). */
export function fetchJob(id: string): Promise<Job> {
  return useApi().get(`/admin/jobs/${id}`)
}
/**
 * `POST /admin/jobs` — start a long job (`pmp.update.check` / `pmp.update.apply`
 * / `ppf.build` / `backup`). `pmp.update.apply` requires critical reauth (§23 #10).
 * Response is `{ job }`.
 */
export function createJob(type: string, args: Record<string, unknown> = {}, reauthToken?: string): Promise<{ job: Job }> {
  return useApi().fetch('/admin/jobs', { method: 'POST', body: { type, args }, headers: reauthHeaders(reauthToken) })
}
/** `POST /admin/jobs/{job_id}/cancel` — cancel a running/queued job. */
export function cancelJob(id: string): Promise<{ cancelled: string }> {
  return useApi().post(`/admin/jobs/${id}/cancel`)
}
/** Retry a failed/cancelled job (§9.4 / §17 `POST /jobs/{job_id}/retry`). */
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
