import type { FetchOptions } from 'ofetch'
import type { MaybeRefOrGetter } from 'vue'
import { useFetch, useRuntimeConfig } from 'nuxt/app'
import { $fetch } from 'ofetch'
import { normalizeFetchError } from '~/utils/api-error'
import { getCsrfToken, refreshCsrfToken } from '~/utils/csrf'

const API_VERSION = '/api/v1'

export type { FetchOptions }

/** JSON-only fetch options — the PPB REST namespace is JSON. */
type JsonFetchOptions = FetchOptions<'json'>

/** JSON body accepted by the typed client (any object / BodyInit / null). */
export type ApiBody = object | BodyInit | null

/** JSON-ish query/body data accepted by the typed client. */
type JsonData = Record<string, unknown>

/** State-changing methods that must carry the CSRF token (§20). */
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Low-level typed fetch against the PPB REST namespace.
 * - Credentialed CORS (`credentials: 'include'`) per design §6.4.
 * - Write methods carry `X-CSRF-Token` (contract §20 / Gate0 S-1); on a CSRF
 *   403 the token is refreshed via `GET /me` and the request is retried once.
 * - Errors are normalized to ApiError keyed by the frozen error code.
 */
export function apiFetch<T>(path: string, opts: JsonFetchOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiBase}${API_VERSION}`
  const method = (opts.method ?? 'GET').toUpperCase()

  function doFetch(extraHeaders: Record<string, string> = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...((opts.headers as Record<string, string>) ?? {}),
      ...extraHeaders,
    }
    return $fetch<T>(path, {
      baseURL,
      credentials: 'include',
      ...opts,
      headers,
    }).catch((err: unknown) => {
      throw normalizeFetchError(err)
    })
  }

  if (CSRF_METHODS.has(method)) {
    const token = getCsrfToken()
    const headers: Record<string, string> = token ? { 'X-CSRF-Token': token } : {}
    return doFetch(headers).catch(async (err: unknown) => {
      const normalized = normalizeFetchError(err)
      // Retry only the explicit CSRF contract error. A generic 403 permission
      // denial must not trigger a token refresh/replay.
      if (normalized.code === 'CSRF_INVALID') {
        const fresh = await refreshCsrfToken(baseURL)
        if (fresh)
          return doFetch({ 'X-CSRF-Token': fresh })
      }
      throw normalized
    })
  }

  return doFetch()
}

export interface ApiClient {
  /** Absolute base URL, e.g. `https://api-phira.htadiy.com/api/v1`. */
  baseURL: string
  fetch: typeof apiFetch
  get: <T>(path: string, params?: object) => Promise<T>
  post: <T>(path: string, body?: ApiBody) => Promise<T>
  put: <T>(path: string, body?: ApiBody) => Promise<T>
  patch: <T>(path: string, body?: ApiBody) => Promise<T>
  delete: <T>(path: string) => Promise<T>
}

/** Convenience client bound to the configured PPB base. */
export function useApi(): ApiClient {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiBase}${API_VERSION}`
  return {
    baseURL,
    fetch: apiFetch,
    get: (path, params) => apiFetch(path, { method: 'GET', query: params as JsonData | undefined }),
    post: (path, body) => apiFetch(path, { method: 'POST', body: body as RequestInit['body'] | JsonData | undefined }),
    put: (path, body) => apiFetch(path, { method: 'PUT', body: body as RequestInit['body'] | JsonData | undefined }),
    patch: (path, body) => apiFetch(path, { method: 'PATCH', body: body as RequestInit['body'] | JsonData | undefined }),
    delete: path => apiFetch(path, { method: 'DELETE' }),
  }
}

/**
 * Reactive variant for data pages that want caching/refetch semantics.
 * Uses the same credentialed base + error normalization. Reserved for
 * Data-page helper built on the same frozen API client used by imperative mutations.
 */
export function useApiFetch<T>(
  path: MaybeRefOrGetter<string>,
  opts: Omit<JsonFetchOptions, 'method'> = {},
) {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiBase}${API_VERSION}`
  return useFetch<T>(path, {
    baseURL,
    credentials: 'include',
    ...opts,
  })
}
