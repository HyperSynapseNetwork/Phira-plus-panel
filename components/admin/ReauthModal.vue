<script setup lang="ts">
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'

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
</script>

<template>
  <UModal :open="open" title="敏感操作重认证" width="max-w-md" @close="emit('cancel')">
    <div class="space-y-3">
      <p class="text-sm text-muted">
        此操作要求重新认证（§23 #10）。输入密码获取短期 reauth context（X-Reauth-Token，TTL 5 分钟）。
      </p>
      <UInput
        :model-value="password"
        type="password"
        label="密码"
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
        <UButton variant="ghost" @click="emit('cancel')">
          取消
        </UButton>
        <UButton variant="danger" :disabled="busy || !props.password" @click="emit('confirm')">
          确认执行
        </UButton>
      </div>
    </template>
  </UModal>
</template>
