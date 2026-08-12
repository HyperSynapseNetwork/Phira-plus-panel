/**
 * Panel admin domain types — aligned with design §18 and the frozen PPB REST
 * namespace (contracts/README §1). PPB Phase B may not be finished; these are
 * the shapes Panel builds against. Where a sub-path / shape is not yet frozen
 * they are marked PROPOSED and collected in docs/PHASE_A_PLAN.md §4b.
 */

import type { Paginated } from './api'
import type { RoomActionId, ServerActionId } from '~/config/action-ids'

// Canonical wire types generated from the PPB OpenAPI contract
// (types/generated.ts, regenerated via scripts/gen-types.sh). Hand-written
// admin types defer to these where they overlap.
export type {
  ChatSendBody,
  ErrorBody,
  ErrorEnvelope,
  MeResponse,
  PaginationResponse,
  PhiraLoginRequest,
  ReauthRequest,
  ReplayDetail,
  ReplayManifest,
  RoomActionBody2,
  RoomActionRequest,
  SendBody,
} from './generated'

// ---------------------------------------------------------------------------
// Permissions (contract §5, P7)
// ---------------------------------------------------------------------------
export interface PermissionManifestEntry {
  id: string
  group: string
  label: string
  description: string
  root_only: boolean
  risk: 'low' | 'medium' | 'high' | 'critical'
}

// ---------------------------------------------------------------------------
// Groups (design §18.5)
// ---------------------------------------------------------------------------
export interface Group {
  id: string
  name: string
  description?: string
  system_kind: 'none' | 'admin_scope' | null
  is_default: boolean
  protected: boolean
  member_count?: number
  permissions: string[]
  created_at?: string
  updated_at?: string
}

export interface GroupPayload {
  name: string
  description?: string
  is_default?: boolean
}

// ---------------------------------------------------------------------------
// Users — unified PPB + PMP admin experience (design §18.4)
// ---------------------------------------------------------------------------
export interface AdminUser {
  id: string
  phira_id: number
  username?: string
  avatar_url?: string
  status: 'active' | 'banned' | 'disabled' | string
  created_at: string
  last_seen_at?: string
  groups?: string[]
  current_room_uuid?: string
  presence?: 'online' | 'offline' | 'in_room' | string
}

export interface UserMultiplayer {
  current_room?: { room_uuid: string, name: string } | null
  visit_history_count?: number
  playtime_secs?: number
  rounds_count?: number
  replay_count?: number
  ban_state?: 'none' | 'banned' | string
}

export interface UserSession {
  id: string
  client_type: 'ppf' | 'panel' | 'windows' | 'android' | string
  created_at: string
  expires_at?: string
  revoked_at?: string
  last_seen_at?: string
  device_name?: string
  ip?: string
}

export interface UserSecurity {
  ban_state?: 'none' | 'banned' | string
  banned_at?: string
  ban_reason?: string
  ip_history?: Array<{ ip: string, seen_at: string, room_uuid?: string }>
  ip_bans?: Array<{ ip: string, banned_at: string, reason?: string }>
}

export interface UserAuditSummary {
  total: number
  events: AuditEvent[]
}

// ---------------------------------------------------------------------------
// Rooms (design §18.3)
// ---------------------------------------------------------------------------
export type RoomState = 'idle' | 'select_chart' | 'waiting_for_ready' | 'playing' | 'closed' | string

export interface RoomChartInfo {
  id?: number
  name?: string
  difficulty?: string
  level?: number
  song_name?: string
}

export interface AdminRoom {
  room_uuid: string
  name: string
  state: RoomState
  host_id?: number
  system_host?: boolean
  members: number
  spectators?: number
  locked?: boolean
  hidden?: boolean
  persistent?: boolean
  degraded?: boolean
  live?: boolean
  current_chart?: RoomChartInfo | null
  current_round_uuid?: string
  max_users?: number
  api_endpoint?: string
  created_at?: string
  updated_at?: string
}

/** Room Action Registry IDs only (contract §20 / Gate0 D-5). */
export type RoomActionName = RoomActionId

export interface RoomActionArgs {
  user_id?: number
  reason?: string
  host_id?: number
  chart_id?: number
  content?: string
  target_room_uuid?: string
  [k: string]: unknown
}

export interface RoomActionResult {
  room_uuid: string
  ok: boolean
  error?: { code: string, message: string }
}

/** Batch room action response — PPB returns `{items, succeeded, failed}` (§17). */
export interface RoomBatchResult {
  items: RoomActionResult[]
  succeeded: number
  failed: number
}

// ---------------------------------------------------------------------------
// Server (design §18.6)
// ---------------------------------------------------------------------------
export interface ServerStatus {
  pmp: {
    connected: boolean
    version?: string
    uptime_secs?: number
    status?: string
  }
  ppb?: {
    version?: string
    uptime_secs?: number
  }
  gates: {
    connections: boolean
    room_creation: boolean
  }
  counts: {
    rooms: number
    users: number
    sessions: number
    plugins: number
  }
  runtime?: {
    cpu_percent?: number
    memory_mb?: number
    network_rx_bps?: number
    network_tx_bps?: number
    disk_percent?: number
  }
  update?: {
    state: 'idle' | 'checking' | 'downloading' | 'verifying' | 'applying' | 'error' | string
    current_version?: string
    target_version?: string
    /** PROPOSED: update check found no newer version. */
    unchanged?: boolean
    progress?: number
    stage?: string
    error?: string
    updated_at?: string
  }
  metrics?: Array<{ t: string, online: number, rooms: number, sessions: number, errors: number }>
}

export type ServerAction = ServerActionId

// ---------------------------------------------------------------------------
// Config — Form Descriptor (design §20.2)
// ---------------------------------------------------------------------------
export type ConfigWidget = 'switch' | 'text' | 'number' | 'select' | 'textarea' | 'secret' | 'yaml'

export interface ConfigFieldDescriptor {
  path: string
  label: string
  description?: string
  group: string
  widget: ConfigWidget
  min?: number
  max?: number
  unit?: string
  enum?: Array<{ label: string, value: string }>
  reload: 'hot' | 'restart' | 'rebuild'
  risk: 'low' | 'medium' | 'high' | 'critical'
  permission?: string
  sensitive?: boolean
  deprecated?: boolean
  order?: number
}

export interface ConfigValue {
  [path: string]: unknown
}

export interface ConfigDiffResult {
  unchanged: string[]
  added: string[]
  removed: string[]
  modified: Array<{ path: string, from: unknown, to: unknown }>
}

export interface ConfigSnapshot {
  id: string
  label: string
  created_at: string
  author?: string
  values_count?: number
}

// ---------------------------------------------------------------------------
// Plugins (design §18.8)
// ---------------------------------------------------------------------------
export interface PluginInfo {
  id: string
  name: string
  version?: string
  enabled: boolean
  description?: string
  exposed_config?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Logs (design §18.11 / §19.1) + log translator (§19.2)
// ---------------------------------------------------------------------------
export interface LogEntry {
  log_id: string
  timestamp: string
  service: 'ppb' | 'pmp' | 'panel' | string
  level: 'debug' | 'info' | 'warn' | 'error' | string
  event?: string
  message: string
  error_code?: string
  request_id?: string
  command_id?: string
  room_uuid?: string
  user_id?: string
}

export interface LogFilter {
  service?: string
  level?: string
  search?: string
  from?: string
  to?: string
  cursor?: string
  /** Locate a specific stable log line (dashboard alert focus, §18.11). */
  log_id?: string
}

export interface LogTranslation {
  title: string
  explanation: string
  module?: string
  severity?: string
  suggestion?: string
}

// ---------------------------------------------------------------------------
// Console / Commands (design §18.10)
// ---------------------------------------------------------------------------
export interface CommandRun {
  command_id: string
  command: string
  action?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string
  output?: string
  error?: string
  executed_at: string
  principal?: string
  scope: 'personal' | 'server'
}

// ---------------------------------------------------------------------------
// Audit (design §18.12 / §24.2)
// ---------------------------------------------------------------------------
export interface AuditEvent {
  id: string
  occurred_at: string
  principal_type: 'root' | 'user' | string
  actor_user_id?: string
  actor_session_id?: string
  action: string
  resource_type: string
  resource_id?: string
  parameters_redacted: Record<string, unknown>
  result: 'success' | 'failure' | 'denied' | string
  error_code?: string
  request_id?: string
  command_id?: string
  ip?: string
  user_agent?: string
}

export interface AuditFilter {
  action?: string
  principal_type?: string
  result?: string
  resource_type?: string
  from?: string
  to?: string
  search?: string
}

// ---------------------------------------------------------------------------
// Jobs (design §9.4) / Admin tasks (§18.14)
// ---------------------------------------------------------------------------
export interface Job {
  id: string
  type: string
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string
  stage?: string
  progress?: number
  error?: string
  created_at: string
  started_at?: string
  finished_at?: string
}

// ---------------------------------------------------------------------------
// Notifications (admin composer, design §18.13)
// ---------------------------------------------------------------------------
export interface AdminNotificationComposer {
  type: string
  priority: 'low' | 'normal' | 'high'
  title: string
  body: string
  target: {
    all?: boolean
    group_ids?: string[]
    user_ids?: string[]
  }
  actions?: Array<{ label: string, action: string, data?: Record<string, unknown> }>
  dedup_key?: string
}

export interface NotificationDelivery {
  id: string
  type: string
  title: string
  target_summary: string
  status: 'queued' | 'delivered' | 'failed' | string
  delivered_count?: number
  failed_count?: number
  sent_at?: string
}

// ---------------------------------------------------------------------------
// Coupons / Admin tasks (design §18.14)
// ---------------------------------------------------------------------------
export type CouponActionType = 'account_unlock' | 'account_role' | 'admin_alert' | 'custom_hook'

export interface Coupon {
  id: string
  code: string
  action_type: CouponActionType
  holder_mode: 'creator' | 'manual'
  status: 'active' | 'revoked' | 'redeemed' | 'expired' | string
  created_at: string
  redeemed_at?: string
  redeemed_by?: string
  note?: string
}

export interface CouponPayload {
  code?: string
  action_type: CouponActionType
  args: Record<string, unknown>
  holder_mode: 'creator' | 'manual'
  note?: string
}

export interface AdminTask {
  id: string
  source: 'coupon' | 'manual'
  type: string
  status: 'pending' | 'completed' | 'failed' | string
  payload?: Record<string, unknown>
  created_at: string
  completed_at?: string
}

// ---------------------------------------------------------------------------
// Automation / Runbooks (design §10)
// ---------------------------------------------------------------------------
export interface RunbookStep {
  action: string
  with?: Record<string, unknown>
  wait?: number
}

export interface Runbook {
  id: string
  name: string
  description?: string
  definition: RunbookStep[]
  args?: Record<string, { type: string, default?: unknown }>
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface RunbookPayload {
  name: string
  description?: string
  definition: RunbookStep[]
  args?: Record<string, { type: string, default?: unknown }>
}

export interface RunbookRun {
  id: string
  runbook_id: string
  runbook_name?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string
  /** 1-based index of the step currently executing (while running). */
  current_step?: number
  step_results?: Array<{ step: number, action: string, ok: boolean, error?: string }>
  /** Definition snapshot captured at run time (§10.3), viewable in history. */
  definition_snapshot?: RunbookStep[]
  started_at?: string
  finished_at?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Generic admin result envelope (proposed; action registry §9)
// ---------------------------------------------------------------------------
export interface ActionExecuteResult {
  ok: boolean
  command_id?: string
  result?: unknown
  error?: { code: string, message: string }
}

export type PaginatedResult<T> = Paginated<T>
