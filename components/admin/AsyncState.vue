<script setup lang="ts">
import { localizePanelError } from '~/utils/api-error'

const props = withDefaults(defineProps<{
  loading?: boolean
  error?: Error | null
  empty?: boolean
  emptyText?: string
  loadingText?: string
}>(), { loading: false, error: null, empty: false })

const { t } = usePanelI18n()
const errorView = computed(() => props.error ? localizePanelError(t, props.error) : null)
</script>

<template>
  <div v-if="loading" class="py-8 text-center text-sm text-muted">
    {{ loadingText || t('common.loading') }}
  </div>
  <div v-else-if="error && errorView" class="py-8 text-center text-sm text-danger" role="alert">
    <p>{{ errorView.message }}</p>
    <details v-if="errorView.requestId" class="mx-auto mt-2 max-w-md text-xs text-muted">
      <summary class="cursor-pointer">{{ t('common.details') }}</summary>
      <p class="mt-1 font-mono">{{ t('common.requestId') }}: {{ errorView.requestId }}</p>
    </details>
  </div>
  <div v-else-if="empty" class="py-8 text-center text-sm text-muted">
    {{ emptyText || t('common.unknown') }}
  </div>
  <slot v-else />
</template>
