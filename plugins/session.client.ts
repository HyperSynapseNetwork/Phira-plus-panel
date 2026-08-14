import { defineNuxtPlugin } from 'nuxt/app'
import { usePanelI18n } from '~/composables/usePanelI18n'
import { useAuthStore } from '~/stores/auth'

/**
 * Probe the PPB session on startup (SPA). The session cookie is HttpOnly;
 * the JWT never reaches the frontend (design §6.4). The auth middleware also
 * guards, so this plugin is a warm-up, not a security boundary.
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (!auth.initialized)
    await auth.loadSession()
  await usePanelI18n().syncFromAccount()
})
