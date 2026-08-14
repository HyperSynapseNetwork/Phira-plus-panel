/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
import type { RoomActionId } from '~/config/action-ids'

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
