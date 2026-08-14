<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import { useAuthStore } from '~/stores/auth'
import { localizePanelError } from '~/utils/api-error'

const { t } = usePanelI18n()

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
    errorMessage.value = t('changePasswordPage.mismatch')
    return
  }
  if (newPassword.value.length < 10) {
    errorMessage.value = t('changePasswordPage.tooShort')
    return
  }
  busy.value = true
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    await router.replace('/')
  }
  catch (err) {
    errorMessage.value = localizePanelError(t, err).message
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
        {{ t('changePasswordPage.title') }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ t('changePasswordPage.subtitle') }}
      </p>
    </div>

    <PPInput
      v-model="currentPassword"
      type="password"
      :label="t('changePasswordPage.current')"
      name="current_password"
      autocomplete="current-password"
      required
    />
    <PPInput
      v-model="newPassword"
      type="password"
      :label="t('changePasswordPage.new')"
      name="new_password"
      autocomplete="new-password"
      required
    />
    <PPInput
      v-model="confirmPassword"
      type="password"
      :label="t('changePasswordPage.confirm')"
      name="confirm_password"
      autocomplete="new-password"
      required
    />

    <p v-if="errorMessage" class="text-sm text-danger" role="alert">
      {{ errorMessage }}
    </p>

    <PPButton
      type="submit"
      weight="primary"
      :disabled="busy || !currentPassword || !newPassword || !confirmPassword"
      full-width
    >
      {{ busy ? t('changePasswordPage.submitting') : t('changePasswordPage.submit') }}
    </PPButton>
  </form>
</template>
