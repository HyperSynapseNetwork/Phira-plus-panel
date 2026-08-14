<script setup lang="ts">
import { computed } from 'vue'

/** Public Phira+ status/badge primitive. */
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const props = withDefaults(defineProps<{
  tone?: Tone
}>(), {
  tone: 'neutral',
})

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-secondary text-surface-foreground',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-danger text-danger-foreground',
  info: 'bg-accent-soft text-accent-soft-foreground',
}

const classes = computed(() => tones[props.tone])
</script>

<template>
  <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-4" :class="classes">
    <slot />
  </span>
</template>
