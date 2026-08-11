import type { ApiClient } from '~/composables/useApi'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreferencesStore } from '~/stores/preferences'

import { DEFAULT_PANEL_PREFS } from '~/types/preferences'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  fetch: vi.fn(),
  baseURL: 'https://api.example.test/api/v1',
}))

vi.mock('~/composables/useApi', () => ({
  useApi: (): ApiClient => apiMock,
  apiFetch: apiMock.fetch,
}))

describe('preferences store (namespace panel)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('load merges the server record over defaults', async () => {
    apiMock.get.mockResolvedValue({
      user_id: 'u1',
      namespace: 'panel',
      revision: 3,
      data: { page_size: 50, density: 'spacious' },
      updated_at: '2026-08-12T00:00:00Z',
    })
    const prefs = usePreferencesStore()
    await prefs.load()
    expect(prefs.loaded).toBe(true)
    expect(prefs.loadError).toBe(false)
    expect(prefs.pageSize).toBe(50)
    expect(prefs.density).toBe('spacious')
    expect(prefs.revision).toBe(3)
    expect(prefs.data.log_wrap).toBe(DEFAULT_PANEL_PREFS.log_wrap)
  })

  it('gracefully degrades when PPB is unavailable (no localStorage fallback)', async () => {
    apiMock.get.mockRejectedValue(new Error('offline'))
    const prefs = usePreferencesStore()
    await prefs.load()
    expect(prefs.loaded).toBe(true)
    expect(prefs.loadError).toBe(true)
    expect(prefs.pageSize).toBe(DEFAULT_PANEL_PREFS.page_size)
  })

  it('update applies a partial patch locally', () => {
    const prefs = usePreferencesStore()
    prefs.update({ density: 'comfortable' })
    expect(prefs.density).toBe('comfortable')
  })

  it('save sends the revision for optimistic concurrency', async () => {
    apiMock.put.mockResolvedValue({
      user_id: 'u1',
      namespace: 'panel',
      revision: 4,
      data: {},
      updated_at: '2026-08-12T00:00:00Z',
    })
    const prefs = usePreferencesStore()
    prefs.revision = 3
    await prefs.save()
    expect(apiMock.put).toHaveBeenCalledWith('/me/preferences/panel', {
      revision: 3,
      data: prefs.data,
    })
    expect(prefs.revision).toBe(4)
  })
})
