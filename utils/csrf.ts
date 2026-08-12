/**
 * CSRF token holder (contract §20 / Gate0 S-1).
 *
 * PPB issues a `csrf_token` from `GET /api/v1/me`; the client echoes it back
 * on every state-changing request via the `X-CSRF-Token` header. The server
 * also validates the `Origin` header (auto-sent by the browser on preflighted
 * cross-origin writes — we never set it manually). Token is rotated by the
 * server; on a CSRF 403 the client refreshes via `/me` and retries once.
 *
 * This is a plain module (not a Pinia store) because `apiFetch` runs outside
 * component context.
 */
let csrfToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function getCsrfToken(): string | null {
  return csrfToken
}

export function clearCsrfToken(): void {
  csrfToken = null
}

/**
 * Refresh the CSRF token from the session probe (`GET /me`). Returns the new
 * token (or null if the session is gone / backend offline). Coalesced so
 * concurrent writers only trigger one refresh.
 */
export function refreshCsrfToken(baseURL: string): Promise<string | null> {
  if (refreshPromise)
    return refreshPromise
  refreshPromise = (async () => {
    try {
      // Native fetch (no ofetch dep) — credentialed so the HttpOnly session
      // cookie is sent; the server validates Origin itself.
      const res = await fetch(`${baseURL}/me`, { credentials: 'include' })
      if (!res.ok) {
        csrfToken = null
        return null
      }
      const data = await res.json() as { csrf_token?: string }
      csrfToken = data.csrf_token ?? null
      return csrfToken
    }
    catch {
      csrfToken = null
      return null
    }
    finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}
