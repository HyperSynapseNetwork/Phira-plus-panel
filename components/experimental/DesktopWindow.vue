<script setup lang="ts">
import { onBeforeUnmount, reactive } from 'vue'
import { loadWindowGeometry, saveWindowGeometry } from '~/utils/window-geometry'

/**
 * Experimental Desktop Window (§22.5) — preference-gated, default off.
 * drag / resize / multi-window skeleton + device-local geometry persistence.
 * Deliberately NOT a taskbar/dock/macOS-traffic-lights clone.
 */
const props = defineProps<{
  id: string
  title: string
  zIndex: number
}>()

const emit = defineEmits<{ close: [], focus: [] }>()

const g = reactive(loadWindowGeometry(props.id))

function save() {
  saveWindowGeometry(props.id, { ...g })
}

// --- drag (via header) ---
function startDrag(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button'))
    return
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const orig = { x: g.x, y: g.y }
  const onMove = (ev: PointerEvent) => {
    g.x = orig.x + ev.clientX - startX
    g.y = orig.y + ev.clientY - startY
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    save()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// --- resize (bottom-right handle) ---
function startResize(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const startY = e.clientY
  const orig = { width: g.width, height: g.height }
  const onMove = (ev: PointerEvent) => {
    g.width = Math.max(240, orig.width + ev.clientX - startX)
    g.height = Math.max(160, orig.height + ev.clientY - startY)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    save()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onBeforeUnmount(() => save())
</script>

<template>
  <section
    class="fixed flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
    :style="{ left: `${g.x}px`, top: `${g.y}px`, width: `${g.width}px`, height: `${g.height}px`, zIndex }"
    role="dialog"
    aria-label="title"
    @pointerdown="emit('focus')"
  >
    <header
      class="flex h-8 shrink-0 cursor-move select-none items-center justify-between border-b border-border px-2"
      @pointerdown="startDrag"
    >
      <span class="truncate text-xs font-medium text-foreground">{{ title }}</span>
      <button
        type="button"
        class="text-muted transition-colors hover:text-foreground"
        aria-label="关闭窗口"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>
    <div class="flex-1 overflow-auto p-2 text-sm text-foreground">
      <slot />
    </div>
    <div
      class="absolute bottom-0 right-0 size-3 cursor-nwse-resize touch-none"
      aria-hidden="true"
      @pointerdown="startResize"
    />
  </section>
</template>
