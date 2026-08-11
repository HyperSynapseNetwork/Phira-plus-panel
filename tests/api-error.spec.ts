import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '~/types/api'
import { ApiError, normalizeFetchError } from '~/utils/api-error'

describe('normalizeFetchError (frozen PPB error contract, P4 UPPER_SNAKE)', () => {
  it('maps the frozen error envelope to ApiError', () => {
    const err = {
      statusCode: 401,
      data: {
        error: {
          code: 'AUTH',
          message: '需要登录',
          request_id: 'req-1',
          details: {},
        },
      },
    }
    const apiErr = normalizeFetchError(err)
    expect(apiErr).toBeInstanceOf(ApiError)
    expect(apiErr.code).toBe('AUTH')
    expect(apiErr.message).toBe('需要登录')
    expect(apiErr.requestId).toBe('req-1')
    expect(apiErr.status).toBe(401)
  })

  it('preserves any unknown server error code as string', () => {
    const apiErr = normalizeFetchError({
      statusCode: 422,
      data: { error: { code: 'FUTURE_SERVER_CODE', message: 'x' } },
    })
    expect(apiErr.code).toBe('FUTURE_SERVER_CODE')
  })

  it('maps an empty error body to a client-local code (P5)', () => {
    const apiErr = normalizeFetchError({ statusCode: 429, data: undefined })
    expect(apiErr.status).toBe(429)
    expect(['NETWORK_ERROR', 'UNKNOWN_ERROR']).toContain(apiErr.code)
  })

  it('maps a network failure to NETWORK_ERROR', () => {
    const apiErr = normalizeFetchError(new TypeError('fetch failed'))
    expect(apiErr.code).toBe('NETWORK_ERROR')
  })

  it('maps a 5xx with empty body to UNKNOWN_ERROR', () => {
    const apiErr = normalizeFetchError({ statusCode: 503, data: null })
    expect(apiErr.code).toBe('UNKNOWN_ERROR')
    expect(apiErr.status).toBe(503)
  })

  it('exposes the frozen code list', () => {
    expect(API_ERROR_CODES).toContain('PHIRA_REAUTH_REQUIRED')
    expect(API_ERROR_CODES).toContain('CAPABILITY_NOT_SUPPORTED')
    expect(API_ERROR_CODES).not.toContain('auth')
  })
})
