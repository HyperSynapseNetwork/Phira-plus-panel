<script setup lang="ts">
import { computed } from 'vue'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: Tone
}>(), {
  hint: '',
  tone: 'neutral',
})

const tones: Record<Tone, string> = {
  neutral: '',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const valueClass = computed(() => tones[props.tone])
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <p class="text-xs text-muted">
      {{ label }}
    </p>
    <p class="mt-2 text-2xl font-semibold text-foreground" :class="valueClass">
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-[11px] text-muted">
      {{ hint }}
    </p>
  </section>
</template>
