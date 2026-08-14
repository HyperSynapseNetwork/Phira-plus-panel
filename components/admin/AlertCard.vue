<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  level: 'warn' | 'error'
  errorCode: string
  message: string
  count: number
  lastSeenAgo: string
  logId?: string
}>(), {
  logId: '',
})

const router = useRouter()

function focus() {
  if (props.logId) {
    void router.push({ path: '/logs', query: { focus: props.logId } })
  }
}

const { t } = usePanelI18n()
</script>

<template>
  <button
    type="button"
    class="w-full rounded border p-3 text-left transition-colors hover:bg-surface-secondary"
    :class="level === 'error' ? 'border-danger/40' : 'border-warning/40'"
    @click="focus"
  >
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium" :class="level === 'error' ? 'text-danger' : 'text-warning'">
        {{ level === 'error' ? 'ERROR' : 'WARN' }} · {{ errorCode }}
      </span>
      <span class="text-[11px] text-muted">{{ t('alertCard.count', { count, time: lastSeenAgo }) }}</span>
    </div>
    <p class="mt-1 text-sm text-foreground">
      {{ message }}
    </p>
    <p v-if="logId" class="mt-1 text-[11px] text-muted">
      {{ t('alertCard.latest') }}
    </p>
  </button>
</template>
