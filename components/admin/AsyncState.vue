<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  error?: Error | null
  empty?: boolean
  emptyText?: string
  loadingText?: string
}>(), {
  loading: false,
  error: null,
  empty: false,
  emptyText: '暂无数据',
  loadingText: '加载中…',
})
</script>

<template>
  <div v-if="loading" class="py-8 text-center text-sm text-muted">
    {{ loadingText }}
  </div>
  <div v-else-if="error" class="py-8 text-center text-sm text-danger">
    {{ error.message || '加载失败' }}
  </div>
  <div v-else-if="empty" class="py-8 text-center text-sm text-muted">
    {{ emptyText }}
  </div>
  <slot v-else />
</template>
