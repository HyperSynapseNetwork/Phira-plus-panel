import type { ApiErrorBody, ClientErrorCode } from '~/types/api'

/**
 * Normalized API error. `code` is the frozen PPB error code when the server
 * returned a well-formed envelope; otherwise it is a client-local category
 * (see CLIENT_ERROR_CODES).
 */
export class ApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown
  readonly status?: number

  constructor(
    code: string,
    message: string,
    opts: {
      requestId?: string
      details?: unknown
      status?: number
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = opts.requestId
    this.details = opts.details
    this.status = opts.status
  }
}

interface RawFetchError {
  statusCode?: number
  status?: number
  data?: unknown
  message?: string
}

function asClientErrorCode(status?: number): ClientErrorCode {
  if (status == null || status >= 500)
    return 'UNKNOWN_ERROR'
  return 'NETWORK_ERROR'
}

/**
 * Normalize any thrown fetch error into an ApiError.
 * - Server envelopes `{error:{code,message,...}}` → code/message/request_id.
 * - Empty envelopes with an HTTP status → generic code + status.
 * - Network-level failures → NETWORK_ERROR.
 */
export function normalizeFetchError(err: unknown): ApiError {
  const raw = (err ?? {}) as RawFetchError
  const status = raw.statusCode ?? raw.status
  const body = raw.data as ApiErrorBody | undefined

  if (body?.error?.code) {
    return new ApiError(body.error.code, body.error.message || '请求失败', {
      requestId: body.error.request_id,
      details: body.error.details,
      status,
    })
  }

  // A server responded but the body is not the frozen envelope.
  if (status != null) {
    return new ApiError(asClientErrorCode(status), raw.message || `请求失败 (${status})`, {
      status,
    })
  }

  return new ApiError('NETWORK_ERROR', raw.message || '无法连接 API 服务', { status })
}
