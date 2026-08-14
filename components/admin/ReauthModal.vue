<script setup lang="ts">
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'

const props = defineProps<{
  open: boolean
  busy: boolean
  error: string
  password: string
}>()

const emit = defineEmits<{
  'update:password': [string]
  'confirm': []
  'cancel': []
}>()

const { t } = usePanelI18n()
</script>

<template>
  <PPModal :open="open" layer="reauth" :title="t('reauth.title')" width="max-w-md" @close="emit('cancel')">
    <div class="space-y-3">
      <p class="text-sm text-muted">
        {{ t('reauth.hint') }}
      </p>
      <PPInput
        :model-value="password"
        type="password"
        :label="t('reauth.password')"
        autocomplete="current-password"
        @update:model-value="v => emit('update:password', v)"
        @keyup.enter="emit('confirm')"
      />
      <p v-if="error" class="text-sm text-danger" role="alert">
        {{ error }}
      </p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <PPButton weight="quiet" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </PPButton>
        <PPButton weight="dangerous" :disabled="busy || !props.password" @click="emit('confirm')">
          {{ t('reauth.confirm') }}
        </PPButton>
      </div>
    </template>
  </PPModal>
</template>
