import { ref } from 'vue'
import { rootReauth } from '~/api/admin'
import { localizePanelError } from '~/utils/api-error'

/**
 * Sensitive-action reauth flow (§23 #10). Elevated writes (ban / IP-ban /
 * permission & member & default-group changes / config rollback / server
 * shutdown / pmp update) must obtain a short-lived reauth context first and
 * carry it as `X-Reauth-Token`.
 *
 * Usage: `reauth.requireReauth(async token => await doThing(token))` then
 * render `<ReauthModal>` bound to the returned state.
 */
export function useReauth() {
  const { t } = usePanelI18n()
  const open = ref(false)
  const password = ref('')
  const busy = ref(false)
  const error = ref('')
  let pending: ((token: string) => Promise<void>) | null = null
  let pendingRisk: 'high' | 'critical' = 'high'

  function requireReauth(action: (token: string) => Promise<void>, risk: 'high' | 'critical' = 'high') {
    pending = action
    pendingRisk = risk
    password.value = ''
    error.value = ''
    open.value = true
  }

  function cancel() {
    open.value = false
    pending = null
    password.value = ''
    error.value = ''
  }

  async function confirm() {
    if (!pending)
      return
    busy.value = true
    error.value = ''
    try {
      const { reauth_token } = await rootReauth(password.value, pendingRisk)
      const action = pending
      open.value = false
      pending = null
      password.value = ''
      await action(reauth_token)
    }
    catch (err) {
      error.value = localizePanelError(t, err).message
    }
    finally {
      busy.value = false
    }
  }

  return { open, password, busy, error, requireReauth, cancel, confirm }
}
