/**
 * Frozen cross-repo contract — PPB REST error + pagination shapes.
 * Source of truth: /root/PhiraPlus-Workspace/contracts/README.md §1-2.
 *
 * The canonical wire types are generated from the PPB OpenAPI contract
 * (`types/generated.ts`, regenerated via `scripts/gen-types.sh`). Hand-written
 * types below defer to the generated types where they overlap — the generated
 * file is the contract authority.
 */
import type { components } from './generated'

// Re-export the generated contract types so consumers use the canonical names.
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

/**
 * Canonical error codes — Contract-Freeze v0 §2 + Main decision P4:
 * codes are UPPER_SNAKE_CASE (e.g. `PHIRA_REAUTH_REQUIRED`). The Panel maps
 * by exact code and preserves any future server code verbatim.
 */
export const API_ERROR_CODES = [
  'REQUEST_ID',
  'PAGINATION',
  'VALIDATION',
  'RATE_LIMIT',
  'AUTH',
  'SESSION',
  'PERMISSION_DENIED',
  'PMP_UNAVAILABLE',
  'CAPABILITY_NOT_SUPPORTED',
  'PHIRA_API_UNAVAILABLE',
  'PHIRA_REAUTH_REQUIRED',
  'LONG_JOB_ACCEPTED',
] as const

/** Canonical server error code, or any future code (kept as string). */
export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | (string & {})

/** Client-local error categories (Main decision P5, NOT server codes). */
export const CLIENT_ERROR_CODES = [
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
  'INVALID_RESPONSE',
] as const

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number]

/**
 * Error envelope — §2: `{"error":{code,message,request_id,details}}`.
 * Alias of the generated `ErrorEnvelope` (generated wins).
 */
export type ApiErrorBody = components['schemas']['ErrorEnvelope']

/**
 * Unified pagination response — §2: `{items:[...], total, page, pageNum}`.
 * Based on the generated `PaginationResponse`, parameterized over the item type.
 */
export type Paginated<T> = Omit<components['schemas']['PaginationResponse'], 'items'> & { items: T[] }

/** Unified pagination request params — §2: `page, pageNum (≤100)`. */
export interface PaginationParams {
  page?: number
  pageNum?: number
}

/** Public meta / capabilities — §9. */
export interface PublicMeta {
  version: string
  api_version: number
  capabilities: string[]
  pmp: {
    connected: boolean
    version: string
    capabilities: string[]
  }
}

/**
 * Session probe — contract §20: `GET /api/v1/me` is the ONLY identity
 * interface. Returns the principal (root | user), runtime-resolved
 * permissions/capabilities, session metadata, and the CSRF token (§21).
 *
 * Based on the generated `MeResponse` (generated wins on overlapping fields);
 * the `unknown` members are narrowed to the shapes the Panel actually reads.
 */
export type MeSession = Omit<components['schemas']['MeResponse'], 'principal' | 'session' | 'user'> & {
  principal: 'root' | 'user' | 'guest'
  /** Present when principal === 'user' (normal admin, Phira login + group). */
  user?: {
    id: string
    phira_id: number
    username?: string
    avatar_url?: string
  }
  session?: {
    sid: string
    client_type: string
    created_at: string
  }
  /** Root first-login must change password (design §6.8). */
  must_change_password?: boolean
}
