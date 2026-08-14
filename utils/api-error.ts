import type { ApiErrorBody, ApiErrorCode, SafeErrorParams } from '~/types/api'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly requestId?: string
  readonly details: { params: SafeErrorParams }
  readonly status?: number

  constructor(code: ApiErrorCode, message: string, opts: { requestId?: string, details?: unknown, status?: number } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = opts.requestId
    this.details = normalizeDetails(opts.details)
    this.status = opts.status
  }
}

interface RawFetchError {
  statusCode?: number
  status?: number
  data?: unknown
  response?: { status?: number, _data?: unknown }
  message?: string
}

function isSafeScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function normalizeDetails(value: unknown): { params: SafeErrorParams } {
  if (!value || typeof value !== 'object')
    return { params: {} }
  const raw = (value as Record<string, unknown>).params
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { params: {} }
  const params: SafeErrorParams = {}
  for (const [key, entry] of Object.entries(raw)) {
    if (isSafeScalar(entry))
      params[key] = entry
  }
  return { params }
}

function asEnvelope(value: unknown): ApiErrorBody | null {
  if (!value || typeof value !== 'object')
    return null
  const error = (value as { error?: unknown }).error
  if (!error || typeof error !== 'object')
    return null
  const e = error as Record<string, unknown>
  if (typeof e.code !== 'string' || !e.code.trim())
    return null
  if (typeof e.message !== 'string')
    return null
  if (typeof e.request_id !== 'string' || !e.request_id.trim())
    return null
  if (!e.details || typeof e.details !== 'object')
    return null
  return value as ApiErrorBody
}

/**
 * Strict transport classification:
 * - no HTTP response => NETWORK_ERROR
 * - HTTP response + frozen envelope => exact server code (future code preserved)
 * - HTTP response + malformed/non-envelope body => INVALID_RESPONSE
 */
export function normalizeFetchError(err: unknown): ApiError {
  if (err instanceof ApiError)
    return err
  const raw = (err ?? {}) as RawFetchError
  const status = raw.response?.status ?? raw.statusCode ?? raw.status
  const body = raw.response?._data ?? raw.data

  if (status != null) {
    const envelope = asEnvelope(body)
    if (envelope) {
      return new ApiError(envelope.error.code, envelope.error.message, {
        requestId: envelope.error.request_id,
        details: envelope.error.details,
        status,
      })
    }
    return new ApiError('INVALID_RESPONSE', 'Invalid API error response', { status })
  }

  return new ApiError('NETWORK_ERROR', raw.message || 'Network error')
}

export function errorI18nKey(error: unknown): string {
  const normalized = normalizeFetchError(error)
  if (['NETWORK_ERROR', 'INVALID_RESPONSE', 'UNKNOWN_ERROR'].includes(normalized.code))
    return `errors.client.${normalized.code}`
  return `errors.api.${normalized.code}`
}

export function localizePanelError(t: (key: string, params?: SafeErrorParams) => string, error: unknown): { message: string, requestId?: string } {
  const normalized = normalizeFetchError(error)
  const key = errorI18nKey(normalized)
  const rendered = t(key, normalized.details.params)
  const message = rendered === key ? t('errors.client.UNKNOWN_ERROR') : rendered
  return { message, requestId: normalized.requestId }
}
