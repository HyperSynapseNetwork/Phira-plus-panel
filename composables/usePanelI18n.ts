import zh from '~/i18n/zh.json'
import en from '~/i18n/en.json'
import { useApi } from '~/composables/useApi'
import { useAuthStore } from '~/stores/auth'

export type PanelLocale = 'zh' | 'en'
type Params = Record<string, string | number>
type CommonPreference = { revision?: number, data?: Record<string, unknown> }

const messages = { zh, en } as const
const STORAGE_KEY = 'pp-panel-language'

function getByPath(source: unknown, path: string): string | undefined {
  let current: unknown = source
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current))
      return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(message: string, params?: Params): string {
  if (!params)
    return message
  return message.replace(/\{([\w.-]+)\}/g, (_match, key: string) => String(params[key] ?? `{${key}}`))
}

export function usePanelI18n() {
  const locale = useState<PanelLocale>('panel:i18n:locale', () => 'zh')
  const initialized = useState<boolean>('panel:i18n:initialized', () => false)

  function applyDocumentLanguage(): void {
    if (import.meta.client)
      document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'
  }

  function t(key: string, params?: Params): string {
    const current = getByPath(messages[locale.value], key)
    const fallback = getByPath(messages.zh, key)
    return interpolate(current ?? fallback ?? key, params)
  }

  function initDeviceLocale(): void {
    if (initialized.value)
      return
    if (import.meta.client) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'zh' || stored === 'en')
        locale.value = stored
      else if (navigator.language.toLowerCase().startsWith('en'))
        locale.value = 'en'
      localStorage.setItem(STORAGE_KEY, locale.value)
    }
    initialized.value = true
    applyDocumentLanguage()
  }

  async function syncFromAccount(): Promise<void> {
    initDeviceLocale()
    const auth = useAuthStore()
    if (!auth.isNormalAdmin)
      return
    try {
      const pref = await useApi().get<CommonPreference>('/me/preferences/common')
      const language = pref.data?.language
      if (language === 'zh' || language === 'en') {
        locale.value = language
        if (import.meta.client)
          localStorage.setItem(STORAGE_KEY, language)
        applyDocumentLanguage()
      }
    }
    catch {
      // Namespace may not exist yet; device locale remains authoritative.
    }
  }

  async function setLocale(next: PanelLocale, persistAccount = true): Promise<void> {
    initDeviceLocale()
    locale.value = next
    if (import.meta.client)
      localStorage.setItem(STORAGE_KEY, next)
    applyDocumentLanguage()

    const auth = useAuthStore()
    if (!persistAccount || !auth.isNormalAdmin)
      return
    const api = useApi()
    let current: CommonPreference = {}
    try {
      current = await api.get<CommonPreference>('/me/preferences/common')
    }
    catch {
      // First write creates the common namespace.
    }
    const data = { ...(current.data ?? {}), language: next }
    await api.put('/me/preferences/common', { data, base_revision: current.revision })
  }

  return { locale, t, initDeviceLocale, syncFromAccount, setLocale }
}
