import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '~/types/api'
import { ApiError, normalizeFetchError } from '~/utils/api-error'

describe('normalizeFetchError (REST Error Contract v1.1)', () => {
  it('maps a valid frozen error envelope to ApiError', () => {
    const err = {
      statusCode: 401,
      data: {
        error: {
          code: 'AUTH_REQUIRED',
          message: 'authentication required',
          request_id: 'req-1',
          details: { params: {} },
        },
      },
    }
    const apiErr = normalizeFetchError(err)
    expect(apiErr).toBeInstanceOf(ApiError)
    expect(apiErr.code).toBe('AUTH_REQUIRED')
    expect(apiErr.requestId).toBe('req-1')
    expect(apiErr.status).toBe(401)
  })

  it('preserves any future server code when the envelope is valid', () => {
    const apiErr = normalizeFetchError({
      statusCode: 422,
      data: { error: { code: 'FUTURE_SERVER_CODE', message: 'debug fallback', request_id: 'req-2', details: { params: {} } } },
    })
    expect(apiErr.code).toBe('FUTURE_SERVER_CODE')
  })

  it('maps an HTTP response outside ErrorEnvelope to INVALID_RESPONSE', () => {
    const apiErr = normalizeFetchError({ statusCode: 429, data: undefined })
    expect(apiErr.status).toBe(429)
    expect(apiErr.code).toBe('INVALID_RESPONSE')
  })

  it('maps a network failure to NETWORK_ERROR', () => {
    const apiErr = normalizeFetchError(new TypeError('fetch failed'))
    expect(apiErr.code).toBe('NETWORK_ERROR')
  })

  it('maps a malformed 5xx body to INVALID_RESPONSE rather than guessing from status', () => {
    const apiErr = normalizeFetchError({ statusCode: 503, data: null })
    expect(apiErr.code).toBe('INVALID_RESPONSE')
    expect(apiErr.status).toBe(503)
  })

  it('exposes generated server codes rather than legacy lowercase/generic codes', () => {
    expect(API_ERROR_CODES).toContain('PHIRA_REAUTH_REQUIRED')
    expect(API_ERROR_CODES).toContain('CAPABILITY_NOT_SUPPORTED')
    expect(API_ERROR_CODES).not.toContain('AUTH')
  })
})
