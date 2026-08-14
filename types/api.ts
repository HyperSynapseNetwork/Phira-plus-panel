/**
 * Frozen cross-repo contract aliases. Generated OpenAPI types are authoritative.
 */
import type { components } from './generated'
import errorManifest from '~/contracts/error-codes.json'

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
  RoomActionRequest,
  SendBody,
} from './generated'

export type KnownApiErrorCode = components['schemas']['ErrorCode']
export const API_ERROR_CODES = errorManifest.codes as readonly KnownApiErrorCode[]
/** Preserve future server codes verbatim; never coerce them to an unrelated code. */
export type ApiErrorCode = KnownApiErrorCode | (string & {})

export const CLIENT_ERROR_CODES = ['NETWORK_ERROR', 'UNKNOWN_ERROR', 'INVALID_RESPONSE'] as const
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number]

export type ApiErrorBody = components['schemas']['ErrorEnvelope']
export type SafeErrorParams = Record<string, string | number | boolean | null>

export type Paginated<T> = Omit<components['schemas']['PaginationResponse'], 'items'> & { items: T[] }
export interface PaginationParams { page?: number, pageNum?: number }

export interface PublicMeta {
  version: string
  api_version: number
  capabilities: string[]
  pmp: { connected: boolean, version: string, capabilities: string[] }
}

export type MeSession = Omit<components['schemas']['MeResponse'], 'principal' | 'session' | 'user'> & {
  principal: 'root' | 'user' | 'guest'
  user?: { id: string, phira_id: number, username?: string, avatar_url?: string }
  session?: { sid: string, client_type: string, created_at: string }
  must_change_password?: boolean
}
