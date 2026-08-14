import type { RoomBatchActionId } from '~/config/action-ids'
import type { AdminRoom, RoomActionArgs, RoomActionName, RoomActionResult, RoomBatchResult } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'
import { normalizeRoom, normalizeRoomListResponse } from '~/utils/rooms'

export async function fetchRooms(params?: Record<string, unknown>): Promise<Paginated<AdminRoom>> {
  const raw: unknown = await useApi().get('/admin/rooms', params)
  return normalizeRoomListResponse(raw, params)
}
/** Create a room (§18.3 Actions create / §17 `POST /rooms`). */
export async function createRoom(payload: { name: string, max_users?: number }): Promise<AdminRoom> {
  const raw: unknown = await useApi().post('/admin/rooms', payload)
  return normalizeRoom(raw)
}
export async function fetchRoom(uuid: string): Promise<AdminRoom> {
  const raw: unknown = await useApi().get(`/admin/rooms/${uuid}`)
  return normalizeRoom(raw)
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
  return useApi().post('/admin/rooms/actions/batch', { action, room_ids: roomIds, args, dry_run: preview })
}
