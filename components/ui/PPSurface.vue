<script setup lang="ts">
/** Readable content surface. It owns content material/radius, not page hierarchy. */
withDefaults(defineProps<{ as?: string, padded?: boolean }>(), { as: 'section', padded: false })
</script>

<template>
  <component :is="as" class="rounded-[var(--pp-radius-surface)] border border-border bg-surface shadow-[var(--pp-shadow-surface)]" :class="padded ? 'p-4' : ''">
    <slot />
  </component>
</template>
