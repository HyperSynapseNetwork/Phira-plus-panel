import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

export type AppearanceTheme = 'dark'
export type AppearanceAccent = 'cyan' | 'blue' | 'violet' | 'green' | 'amber'
export interface CommonAppearancePreference {
  theme: AppearanceTheme
  accent: AppearanceAccent
  reducedMotion: boolean
  reducedTransparency: boolean
}
const DEFAULTS: CommonAppearancePreference = { theme: 'dark', accent: 'cyan', reducedMotion: false, reducedTransparency: false }
const STORAGE_KEY = 'pp-panel-common-appearance'

export function useCommonAppearance() {
  const value = useState<CommonAppearancePreference>('panel:common-appearance', () => ({ ...DEFAULTS }))
  const loaded = useState<boolean>('panel:common-appearance:loaded', () => false)
  const syncStatus = useState<'synced' | 'device-only' | 'unavailable'>('panel:common-appearance:sync', () => 'device-only')
  function normalize(raw: any): CommonAppearancePreference {
    return {
      theme: 'dark',
      accent: ['cyan','blue','violet','green','amber'].includes(raw?.accent) ? raw.accent : DEFAULTS.accent,
      reducedMotion: raw?.reduced_motion === true || raw?.reducedMotion === true,
      reducedTransparency: raw?.reduced_transparency === true || raw?.reducedTransparency === true,
    }
  }
  function apply() {
    if (!import.meta.client) return
    const root = document.documentElement
    const resolved: AppearanceTheme = 'dark'
    root.dataset.theme = resolved
    root.dataset.accent = value.value.accent
    root.dataset.reducedMotion = String(value.value.reducedMotion)
    root.dataset.reducedTransparency = String(value.value.reducedTransparency)
    root.classList.toggle('dark', resolved === 'dark')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value.value))
  }
  async function load() {
    if (import.meta.client) {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) value.value = normalize(JSON.parse(raw)) } catch {}
    }
    const auth = useAuthStore()
    if (auth.isNormalAdmin) {
      try { const rec = await useApi().get<any>('/me/preferences/common'); value.value = normalize(rec.data ?? {}); syncStatus.value = 'synced' }
      catch { syncStatus.value = 'unavailable' }
    } else syncStatus.value = 'device-only'
    loaded.value = true; apply()
  }
  async function save(next: CommonAppearancePreference = value.value) {
    value.value = { ...next }; apply()
    const auth = useAuthStore(); if (!auth.isNormalAdmin) { syncStatus.value = 'device-only'; return }
    const api = useApi()
    try {
      const current:any = await api.get('/me/preferences/common')
      await api.put('/me/preferences/common', { data: { ...(current.data ?? {}), theme: value.value.theme, accent: value.value.accent, reduced_motion: value.value.reducedMotion, reduced_transparency: value.value.reducedTransparency }, base_revision: current.revision })
      syncStatus.value = 'synced'
    } catch (err) { syncStatus.value = 'unavailable'; throw err }
  }
  return { value, loaded, syncStatus, load, save, apply }
}
