<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  width?: string
}>(), {
  open: false,
  title: '',
  width: 'max-w-2xl',
})

const emit = defineEmits<{ close: [] }>()

const titleId = `umodal-title-${Math.random().toString(36).slice(2, 8)}`
const panelEl = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(() => props.open, (open) => {
  if (open) {
    lastFocused = document.activeElement as HTMLElement | null
    // Move focus into the dialog after mount for screen-reader + keyboard users.
    requestAnimationFrame(() => panelEl.value?.focus())
  }
  else if (lastFocused) {
    lastFocused.focus?.()
    lastFocused = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
    >
      <div class="absolute inset-0 bg-backdrop" @click="emit('close')" />
      <div
        ref="panelEl"
        tabindex="-1"
        class="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-overlay focus:outline-none"
        :class="width"
      >
        <header
          v-if="title"
          class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"
        >
          <h3 :id="titleId" class="text-sm font-semibold text-foreground">
            {{ title }}
          </h3>
          <button
            type="button"
            class="rounded p-1 text-muted transition-colors hover:text-foreground"
            aria-label="关闭"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>
        <div class="flex-1 overflow-auto p-4">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="shrink-0 border-t border-border px-4 py-3">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
