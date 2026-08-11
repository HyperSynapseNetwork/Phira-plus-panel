import type { FetchOptions } from 'ofetch'
import type { MaybeRefOrGetter } from 'vue'
import { useFetch, useRuntimeConfig } from 'nuxt/app'
import { $fetch } from 'ofetch'
import { normalizeFetchError } from '~/utils/api-error'

const API_VERSION = '/api/v1'

export type { FetchOptions }

/** JSON-only fetch options — the PPB REST namespace is JSON. */
type JsonFetchOptions = FetchOptions<'json'>

/** JSON body accepted by the typed client (any object / BodyInit / null). */
export type ApiBody = object | BodyInit | null

/** JSON-ish query/body data accepted by the typed client. */
type JsonData = Record<string, unknown>

/**
 * Low-level typed fetch against the PPB REST namespace.
 * - Credentialed CORS (`credentials: 'include'`) per design §6.4.
 * - Errors are normalized to ApiError keyed by the frozen error code.
 */
export function apiFetch<T>(path: string, opts: JsonFetchOptions = {}): Promise<T> {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiBase}${API_VERSION}`
  return $fetch<T>(path, {
    baseURL,
    credentials: 'include',
    ...opts,
  }).catch((err: unknown) => {
    throw normalizeFetchError(err)
  })
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
 * Phase C data pages; Phase A infrastructure is `useApi().fetch`.
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
