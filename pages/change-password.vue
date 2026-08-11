<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import { useAuthStore } from '~/stores/auth'
import { ApiError } from '~/utils/api-error'

definePageMeta({
  layout: 'auth',
})

const auth = useAuthStore()
const router = useRouter()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const busy = ref(false)

async function submit() {
  errorMessage.value = ''
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }
  if (newPassword.value.length < 10) {
    errorMessage.value = '新密码至少 10 位'
    return
  }
  busy.value = true
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    await router.replace('/')
  }
  catch (err) {
    errorMessage.value = err instanceof ApiError ? err.message : '修改失败，请重试'
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
        修改 Root 密码
      </h2>
      <p class="mt-1 text-sm text-muted">
        首次登录必须修改默认随机密码。
      </p>
    </div>

    <UInput
      v-model="currentPassword"
      type="password"
      label="当前密码"
      name="current_password"
      autocomplete="current-password"
      required
    />
    <UInput
      v-model="newPassword"
      type="password"
      label="新密码"
      name="new_password"
      autocomplete="new-password"
      required
    />
    <UInput
      v-model="confirmPassword"
      type="password"
      label="确认新密码"
      name="confirm_password"
      autocomplete="new-password"
      required
    />

    <p v-if="errorMessage" class="text-sm text-danger" role="alert">
      {{ errorMessage }}
    </p>

    <UButton
      type="submit"
      variant="primary"
      :disabled="busy || !currentPassword || !newPassword || !confirmPassword"
      full-width
    >
      {{ busy ? '提交中…' : '修改密码' }}
    </UButton>
  </form>
</template>
