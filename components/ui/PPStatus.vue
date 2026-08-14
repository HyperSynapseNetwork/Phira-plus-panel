<script setup lang="ts">
import { computed } from 'vue'

/**
 * Phira+ 状态 Chip（§二十二）：只在真正需要扫描识别的状态才用（LIVE/ERROR/BANNED…）。
 * 普通「在线 43」只是文字，不要套 badge。
 */
type Tone = 'live' | 'error' | 'banned' | 'success' | 'warning' | 'neutral' | 'info'

const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'live' })

const tones: Record<Tone, string> = {
  live: 'bg-[var(--pp-live)] text-[var(--pp-accent-fg)]',
  error: 'bg-danger text-white',
  banned: 'bg-danger text-white',
  success: 'bg-success text-black',
  warning: 'bg-warning text-black',
  neutral: 'border border-border bg-surface-secondary text-muted',
  info: 'bg-[var(--pp-info)] text-black',
}

const classes = computed(() => tones[props.tone])
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-[var(--pp-radius-capsule)] px-2 py-0.5 text-[11px] font-medium leading-4"
    :class="classes"
  >
    <slot />
  </span>
</template>
