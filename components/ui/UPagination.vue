<script setup lang="ts">
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
    <span>共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        上一页
      </button>
      <button
        type="button"
        class="rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>
