<script setup lang="ts">
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
        Root 登录
      </h2>
      <p class="mt-1 text-sm text-muted">
        首次启动的随机密码由服务端 CLI 输出。
      </p>
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
