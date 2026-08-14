/**
 * Compatibility barrel for Panel domain types.
 *
 * New code should import from `~/features/<domain>/types`; existing pages may
 * continue using this barrel during incremental migration. Generated OpenAPI
 * remains the source of truth for wire DTOs.
 */

export type {
  ChatSendBody, ErrorBody, ErrorEnvelope, GroupRef, MeResponse, PaginationResponse,
  PhiraLoginRequest, ReauthRequest, ReplayDetail, ReplayManifest, RoomActionBody2,
  RoomActionRequest, SendBody, TranslatedError, TranslateParams, TranslateResponse,
} from './generated'

export * from '~/features/permissions/types'
export * from '~/features/groups/types'
export * from '~/features/users/types'
export * from '~/features/rooms/types'
export * from '~/features/server/types'
export * from '~/features/config/types'
export * from '~/features/plugins/types'
export * from '~/features/logs/types'
export * from '~/features/console/types'
export * from '~/features/audit/types'
export * from '~/features/jobs/types'
export * from '~/features/notifications/types'
export * from '~/features/redemption/types'
export * from '~/features/automation/types'
export * from '~/features/common/types'
