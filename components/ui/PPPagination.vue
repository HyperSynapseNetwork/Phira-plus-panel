<script setup lang="ts">
const { t } = usePanelI18n()
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  page?: number
  pageNum?: number
  total?: number
}>(), {
  page: 1,
  pageNum: 25,
  total: 0,
})

const emit = defineEmits<{ 'update:page': [value: number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageNum))))
</script>

<template>
  <div class="flex items-center justify-between px-1 py-2 text-sm text-muted">
    <span>{{ t('pagination.summary', { total, page, pages: totalPages }) }}</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        {{ t('pagination.previous') }}
      </button>
      <button
        type="button"
        class="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      >
        {{ t('pagination.next') }}
      </button>
    </div>
  </div>
</template>
