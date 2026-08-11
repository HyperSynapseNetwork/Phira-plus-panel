import { describe, expect, it } from 'vitest'
import { ApiError, normalizeFetchError } from '~/utils/api-error'

describe('normalizeFetchError (frozen PPB error contract)', () => {
  it('maps the frozen error envelope to ApiError', () => {
    const err = {
      statusCode: 401,
      data: {
        error: {
          code: 'auth',
          message: '需要登录',
          request_id: 'req-1',
          details: {},
        },
      },
    }
    const apiErr = normalizeFetchError(err)
    expect(apiErr).toBeInstanceOf(ApiError)
    expect(apiErr.code).toBe('auth')
    expect(apiErr.message).toBe('需要登录')
    expect(apiErr.requestId).toBe('req-1')
    expect(apiErr.status).toBe(401)
  })

  it('preserves any unknown server error code as string', () => {
    const apiErr = normalizeFetchError({
      statusCode: 422,
      data: { error: { code: 'future_server_code', message: 'x' } },
    })
    expect(apiErr.code).toBe('future_server_code')
  })

  it('maps an empty error body to a client-local code', () => {
    const apiErr = normalizeFetchError({ statusCode: 429, data: undefined })
    expect(apiErr.status).toBe(429)
    expect(['network_error', 'unknown_error']).toContain(apiErr.code)
  })

  it('maps a network failure to network_error', () => {
    const apiErr = normalizeFetchError(new TypeError('fetch failed'))
    expect(apiErr.code).toBe('network_error')
  })

  it('maps a 5xx with empty body to unknown_error', () => {
    const apiErr = normalizeFetchError({ statusCode: 503, data: null })
    expect(apiErr.code).toBe('unknown_error')
    expect(apiErr.status).toBe(503)
  })
})
