/**
 * Frozen cross-repo contract — PPB REST error + pagination shapes.
 * Source of truth: /root/PhiraPlus-Workspace/contracts/README.md §1-2.
 *
 * These are typed views of the frozen contract; they must NOT drift from the
 * PPB-generated OpenAPI manifest once that lands (contracts/README preamble).
 */

/** Canonical error codes enumerated in Contract-Freeze v0 §2. */
export const API_ERROR_CODES = [
  'request_id',
  'pagination',
  'validation',
  'rate_limit',
  'auth',
  'session',
  'permission_denied',
  'pmp_unavailable',
  'capability_not_supported',
  'phira_api_unavailable',
  'phira_reauth_required',
  'long_job_accepted',
] as const

/** Canonical server error code, or any future code (kept as string). */
export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | (string & {})

/** Client-local error categories (NOT part of the frozen contract). */
export const CLIENT_ERROR_CODES = [
  'network_error',
  'unknown_error',
  'invalid_response',
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
