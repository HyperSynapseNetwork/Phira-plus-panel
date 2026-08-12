/**
 * Frozen cross-repo contract — PPB REST error + pagination shapes.
 * Source of truth: /root/PhiraPlus-Workspace/contracts/README.md §1-2.
 *
 * These are typed views of the frozen contract; they must NOT drift from the
 * PPB-generated OpenAPI manifest once that lands (contracts/README preamble).
 */

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

/** Error envelope — §2: `{"error":{code,message,request_id,details}}`. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    request_id?: string
    details?: Record<string, unknown>
  }
}

/** Unified pagination response — §2: `{items:[...], total, page, pageNum}`. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageNum: number
}

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
 * `/me/profile` no longer acts as a session probe.
 */
export interface MeSession {
  principal: 'root' | 'user' | 'guest'
  /** Present when principal === 'user' (normal admin, Phira login + group). */
  user?: {
    id: string
    phira_id: number
    username?: string
    avatar_url?: string
  }
  permissions: string[]
  capabilities: string[]
  session?: {
    sid: string
    client_type: string
    created_at: string
  }
  /** CSRF token for state-changing requests (contract §20/§21). */
  csrf_token?: string
  /** Root first-login must change password (design §6.8). */
  must_change_password?: boolean
}
