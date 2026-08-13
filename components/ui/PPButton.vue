<script setup lang="ts">
import { computed } from 'vue'

/**
 * Phira+ button（§十四 按行为重量）：primary / secondary / quiet / dangerous。
 * 状态统一：default / hover / pressed / focus-visible / disabled / loading（§三十一）。
 * 无 gradient、无 pill 默认、无发光。primary 用 --pp-accent 信号色，仅限当前主行为。
 */
type Weight = 'primary' | 'secondary' | 'quiet' | 'dangerous'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  weight?: Weight
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}>(), {
  weight: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
})

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}
const weights: Record<Weight, string> = {
  primary: 'bg-accent text-accent-foreground hover:bg-[var(--pp-accent-hover)]',
  secondary: 'border border-border bg-surface-secondary text-foreground hover:bg-surface',
  quiet: 'text-muted hover:bg-surface hover:text-foreground',
  dangerous: 'bg-danger text-white hover:brightness-110',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 font-medium',
  'rounded-[var(--pp-radius-control)]',
  'transition-[background-color,transform] duration-150',
  'active:scale-[0.98]',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
  'disabled:pointer-events-none disabled:opacity-50',
  sizes[props.size],
  weights[props.weight],
].join(' '))
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="classes"
  >
    <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>
