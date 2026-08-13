import type { AdminRoom, RoomChartInfo } from '~/types/admin'
import type { Paginated } from '~/types/api'

/**
 * Room response normalization.
 *
 * PPB's `GET /api/v1/rooms` and `GET /api/v1/admin/rooms` currently pass the
 * PMP `room.list` payload through verbatim (a `{rooms:[...]}` / `{results:[...]}`
 * object, or a bare array), not the frozen `Paginated<AdminRoom>` shape
 * (`{items, total, page, pageNum}`). This module normalizes whatever shape the
 * server sends into the Panel's `AdminRoom` contract so the room list page
 * never dereferences a missing `items`/`rooms` array.
 *
 * Field mapping is limited to what PPB already exposes and what the Panel reads:
 *   - `room_id`  → `room_uuid` (PMP's room identifier)
 *   - `players`  → `members`  (PMP exposes `players` as an array)
 *   - `host_id` / `host.user_id` / `host.id` → `host_id`
 * Everything else passes through untouched; when PPB later returns the canonical
 * paginated shape these helpers are idempotent.
 */

type RawRecord = Record<string, unknown>

function asRecord(value: unknown): RawRecord | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as RawRecord
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/** A count that PMP may send as a number or as an array (e.g. `players`). */
function countOf(value: unknown): number | undefined {
  if (typeof value === 'number')
    return value
  if (Array.isArray(value))
    return value.length
  return undefined
}

function roomUuid(room: RawRecord): string {
  return asString(room.room_uuid) ?? asString(room.room_id) ?? ''
}

function hostId(room: RawRecord): number | undefined {
  const direct = asNumber(room.host_id)
  if (direct != null)
    return direct
  const host = asRecord(room.host)
  if (host) {
    const id = asNumber(host.user_id) ?? asNumber(host.id)
    if (id != null)
      return id
  }
  return undefined
}

function membersOf(room: RawRecord): number {
  return countOf(room.members) ?? countOf(room.players) ?? 0
}

/** Normalize a single PMP/PPB room object into the Panel `AdminRoom` contract. */
export function normalizeRoom(raw: unknown): AdminRoom {
  const room = asRecord(raw) ?? {}
  return {
    room_uuid: roomUuid(room),
    name: asString(room.name) ?? '',
    state: asString(room.state) ?? 'idle',
    host_id: hostId(room),
    system_host: asBool(room.system_host),
    members: membersOf(room),
    spectators: countOf(room.spectators),
    locked: asBool(room.locked),
    hidden: asBool(room.hidden),
    persistent: asBool(room.persistent),
    degraded: asBool(room.degraded),
    live: asBool(room.live),
    current_chart: (room.current_chart ?? null) as RoomChartInfo | null,
    current_round_uuid: asString(room.current_round_uuid),
    max_users: asNumber(room.max_users),
    api_endpoint: asString(room.api_endpoint),
    created_at: asString(room.created_at),
    updated_at: asString(room.updated_at),
  }
}

/**
 * Extract the room array from any shape PPB may return today:
 * a bare array, `{items}`, `{rooms}` or `{results}`.
 */
export function normalizeRoomList(raw: unknown): AdminRoom[] {
  if (Array.isArray(raw))
    return raw.map(normalizeRoom)
  const record = asRecord(raw)
  if (record == null)
    return []
  const arr = [record.items, record.rooms, record.results].find(
    (candidate): candidate is unknown[] => Array.isArray(candidate),
  )
  return arr != null ? arr.map(normalizeRoom) : []
}

/**
 * Normalize a room-list response into `Paginated<AdminRoom>`. `total` is taken
 * from the server when present, otherwise derived from the (un-paginated) list.
 */
export function normalizeRoomListResponse(raw: unknown, params?: Record<string, unknown>): Paginated<AdminRoom> {
  const items = normalizeRoomList(raw)
  const record = asRecord(raw)
  const total = record != null && typeof record.total === 'number' ? record.total : items.length
  const page = typeof params?.page === 'number' ? params.page : 1
  const pageNum = typeof params?.pageNum === 'number' ? params.pageNum : (items.length || 1)
  return { items, total, page, pageNum }
}
