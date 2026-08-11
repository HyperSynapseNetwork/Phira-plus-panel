<script setup lang="ts">
import { buttonVariants } from '@heroui/styles'
import { computed } from 'vue'

/**
 * Local Vue wrapper over the HeroUI design system (design §3.4).
 * Uses `@heroui/styles` `buttonVariants()` (Tailwind Variants) — no React,
 * no third-party `@heroui/vue` package.
 */
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline' | 'danger' | 'danger-soft'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  fullWidth?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  fullWidth: false,
})

const classes = computed(() =>
  buttonVariants({
    variant: props.variant,
    size: props.size,
    fullWidth: props.fullWidth,
  }),
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="classes"
  >
    <slot />
  </button>
</template>
