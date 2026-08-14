import type { ApiClient } from '~/composables/useApi'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreferencesStore } from '~/stores/preferences'
import { DEFAULT_PANEL_PREFS } from '~/types/preferences'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), fetch: vi.fn(), baseURL: 'https://api.example.test/api/v1' }))
vi.mock('~/composables/useApi', () => ({ useApi: (): ApiClient => apiMock, apiFetch: apiMock.fetch }))

describe('panel preference truthfulness', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('keeps only preferences with current product consumers', async () => {
    apiMock.get.mockResolvedValue({ user_id:'u1', namespace:'panel', revision:3, data:{ sidebar:{collapsed:true}, low_performance:true, page_size:999, dashboard_layout:'grid' }, updated_at:'2026-08-14T00:00:00Z' })
    const prefs=usePreferencesStore(); await prefs.load()
    expect(prefs.data.sidebar.collapsed).toBe(true)
    expect(prefs.data.low_performance).toBe(true)
    expect('page_size' in prefs.data).toBe(false)
    expect('dashboard_layout' in prefs.data).toBe(false)
  })
  it('falls back to authoritative in-memory defaults on load failure', async () => {
    apiMock.get.mockRejectedValue(new Error('offline')); const prefs=usePreferencesStore(); await prefs.load(); expect(prefs.loadError).toBe(true); expect(prefs.data).toEqual(DEFAULT_PANEL_PREFS)
  })
  it('save sends only the normalized active preference payload', async () => {
    apiMock.put.mockResolvedValue({ user_id:'u1', namespace:'panel', revision:4, data:DEFAULT_PANEL_PREFS, updated_at:'2026-08-14T00:00:00Z' })
    const prefs=usePreferencesStore(); prefs.revision=3; await prefs.save(); expect(apiMock.put).toHaveBeenCalledWith('/me/preferences/panel',{revision:3,data:DEFAULT_PANEL_PREFS}); expect(prefs.revision).toBe(4)
  })
})
