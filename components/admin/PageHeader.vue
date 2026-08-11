<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
}>(), {
  subtitle: '',
})
</script>

<template>
  <div class="mb-4 flex items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="mt-0.5 text-xs text-muted">
        {{ subtitle }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
