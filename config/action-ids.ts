/**
 * Action Registry IDs (contract §20 / §6 / Gate0 D-5).
 *
 * Panel/PPF only send Action Registry IDs (`room.lock`, `room.kick`,
 * `room.force_move`, `pmp.cli.execute`, …) — never self-made bare names
 * (`lock`/`kick`/`blacklist_add`). The registry is the single source of
 * truth server-side; this module centralises the ids the Panel uses so they
 * can be reconciled against the PPB Action Manifest in one place.
 */

export const ROOM_ACTION = {
  close: 'room.close',
  /** §22: `room.lock { locked: bool }` — unlock is `room.lock { locked: false }`. */
  lock: 'room.lock',
  cycle: 'room.cycle',
  setHidden: 'room.set_hidden',
  setPersistent: 'room.set_persistent',
  setLive: 'room.set_live',
  setHost: 'room.set_host',
  start: 'room.start',
  cancelStart: 'room.cancel_start',
  ready: 'room.ready',
  setChart: 'room.set_chart',
  kick: 'room.kick',
  forceMove: 'room.force_move',
  ban: 'room.ban',
  whitelistAdd: 'room.whitelist_add',
  whitelistRemove: 'room.whitelist_remove',
  blacklistBan: 'room.ban',
  blacklistUnban: 'room.unban',
} as const

export type RoomActionId = (typeof ROOM_ACTION)[keyof typeof ROOM_ACTION]

/**
 * Server actions (§23 #2 canonical switch): `server.config_reload` /
 * `server.shutdown` / `server.roomcreation` / `server.connections`.
 *
 * NOTE: PMP update operations are NOT server actions anymore — they are
 * long-running jobs (design §9.4) created via `POST /admin/jobs` with the
 * `UPDATE_JOB` types below. The old `pmp.update.*` action IDs are retired.
 */
export const SERVER_ACTION = {
  configReload: 'server.config_reload',
  shutdown: 'server.shutdown',
  setConnections: 'server.connections',
  setRoomCreation: 'server.roomcreation',
} as const

export type ServerActionId = (typeof SERVER_ACTION)[keyof typeof SERVER_ACTION]

/**
 * PMP update job types (design §9.4 / §23 #7 honest stage). Update operations
 * run through the Job API (`POST /admin/jobs` → poll → cancel/retry), not the
 * Action Registry. `check` is non-destructive; `apply` requires reauth (§23 #10).
 */
export const UPDATE_JOB = {
  check: 'pmp.update.check',
  apply: 'pmp.update.apply',
} as const

export type UpdateJobType = (typeof UPDATE_JOB)[keyof typeof UPDATE_JOB]

export const USER_ACTION = {
  ban: 'player.ban',
  unban: 'player.unban',
  kick: 'player.kick',
  banIp: 'player.ban_ip',
  unbanIp: 'player.unban_ip',
  revokeSessions: 'user.revoke_sessions',
} as const

export type UserActionId = (typeof USER_ACTION)[keyof typeof USER_ACTION]

/** Batch room actions allowed by the contract (§18.3 batch: kick/move/ban). */
export const ROOM_BATCH_ACTION = {
  kick: 'room.kick',
  forceMove: 'room.force_move',
  ban: 'room.ban',
} as const

export type RoomBatchActionId = (typeof ROOM_BATCH_ACTION)[keyof typeof ROOM_BATCH_ACTION]
