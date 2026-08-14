<script setup lang="ts">
import { useRuntimeConfig } from 'nuxt/app'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import { useAuthStore } from '~/stores/auth'
import { localizePanelError } from '~/utils/api-error'

const { t, locale } = usePanelI18n()

definePageMeta({
  requiresAuth: false,
  layout: 'auth',
})

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

const password = ref('')
const errorMessage = ref('')
const busy = ref(false)

function errorText(err: unknown): string {
  return localizePanelError(t, err).message
}

/**
 * Normal-admin login (contract §20: ordinary PPB User via Phira login +
 * group membership can enter Panel). Redirect to the PPB Auth Gateway (P13);
 * `client_type=panel` tells the Gateway this is the Panel (not PPF) so the
 * post-login return goes back to the Panel, and `return_to` is a relative `/`
 * (the Gateway whitelists it — never an absolute origin).
 */
function phiraLoginUrl(): string {
  const base = config.public.apiBase
  return `${base}/auth/phira/login?client_type=panel&lang=${encodeURIComponent(locale.value)}&return_to=${encodeURIComponent('/')}`
}

function githubLoginUrl(): string {
  const base = config.public.apiBase
  return `${base}/auth/phira/login?client_type=panel&intent=github&lang=${encodeURIComponent(locale.value)}&return_to=${encodeURIComponent('/')}`
}

async function submit() {
  busy.value = true
  errorMessage.value = ''
  try {
    await auth.login(password.value)
    if (auth.requiresPasswordChange) {
      await router.replace('/change-password')
    }
    else {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      await router.replace(redirect)
    }
  }
  catch (err) {
    errorMessage.value = errorText(err)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <h2 class="text-lg font-semibold text-foreground">
        {{ t('auth.adminLogin') }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ t('auth.adminLoginHint') }}
      </p>
    </div>

    <a
      :href="phiraLoginUrl()"
      data-pp-touch-critical="auth-phira"
      class="pp-touch-target flex w-full items-center justify-center rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
    >
      {{ t('auth.phiraLogin') }}
    </a>

    <a
      :href="githubLoginUrl()"
      data-pp-touch-critical="auth-github"
      class="pp-touch-target flex w-full items-center justify-center rounded border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-tertiary"
    >
      {{ t('auth.githubLogin') }}
    </a>
    <p class="text-xs text-muted">
      {{ t('auth.gatewayHint') }}
    </p>

    <div class="flex items-center gap-2 text-xs text-muted">
      <span class="h-px flex-1 bg-border" />
      {{ t('auth.rootLogin') }}
      <span class="h-px flex-1 bg-border" />
    </div>

    <PPInput
      v-model="password"
      type="password"
      :label="t('auth.rootPassword')"
      name="password"
      autocomplete="current-password"
      required
      data-testid="root-password"
    />

    <p v-if="errorMessage" class="text-sm text-danger" role="alert" data-testid="login-error">
      {{ errorMessage }}
    </p>

    <PPButton
      type="submit"
      weight="primary"
      :disabled="busy || !password"
      full-width
      data-testid="root-login-submit"
    >
      {{ busy ? t('auth.signingIn') : t('auth.login') }}
    </PPButton>
  </form>
</template>
