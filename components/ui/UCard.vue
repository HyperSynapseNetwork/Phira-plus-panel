<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  padded?: boolean
}>(), {
  title: '',
  subtitle: '',
  padded: true,
})
</script>

<template>
  <section class="rounded-lg border border-border bg-surface">
    <header v-if="title || $slots.header" class="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <h3 class="text-sm font-medium text-foreground">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="mt-0.5 text-xs text-muted">
          {{ subtitle }}
        </p>
      </div>
      <slot name="header" />
    </header>
    <div :class="padded ? 'p-4' : ''">
      <slot />
    </div>
  </section>
</template>
