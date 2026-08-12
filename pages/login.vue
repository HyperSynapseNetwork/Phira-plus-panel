<script setup lang="ts">
import { useRuntimeConfig } from 'nuxt/app'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import { useAuthStore } from '~/stores/auth'
import { ApiError } from '~/utils/api-error'

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
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'AUTH':
      case 'SESSION':
        return '凭据无效或会话已过期'
      case 'RATE_LIMIT':
        return '请求过于频繁，请稍后再试'
      case 'VALIDATION':
        return '输入不合法'
      case 'PERMISSION_DENIED':
        return '该账户无管理权限'
      case 'PMP_UNAVAILABLE':
        return 'PMP 不可用，请稍后再试'
      case 'NETWORK_ERROR':
        return '无法连接 API，请检查网络'
      default:
        return err.message || '登录失败'
    }
  }
  return '登录失败，请重试'
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
  return `${base}/auth/phira/login?client_type=panel&return_to=${encodeURIComponent('/')}`
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
        管理员登录
      </h2>
      <p class="mt-1 text-sm text-muted">
        普通管理员使用 Phira 账号（组成员）登录；Root 为应急本地主体。
      </p>
    </div>

    <a
      :href="phiraLoginUrl()"
      class="flex w-full items-center justify-center rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
    >
      使用 Phira 账号登录
    </a>

    <div class="flex items-center gap-2 text-xs text-muted">
      <span class="h-px flex-1 bg-border" />
      Root 密码登录
      <span class="h-px flex-1 bg-border" />
    </div>

    <UInput
      v-model="password"
      type="password"
      label="Root 密码"
      name="password"
      autocomplete="current-password"
      required
      data-testid="root-password"
    />

    <p v-if="errorMessage" class="text-sm text-danger" role="alert" data-testid="login-error">
      {{ errorMessage }}
    </p>

    <UButton
      type="submit"
      variant="primary"
      :disabled="busy || !password"
      full-width
      data-testid="root-login-submit"
    >
      {{ busy ? '登录中…' : '登录' }}
    </UButton>
  </form>
</template>
