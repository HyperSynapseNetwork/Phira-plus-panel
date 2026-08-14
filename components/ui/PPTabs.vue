<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  tabs?: Array<{ key: string, label: string }>
}>(), {
  modelValue: '',
  tabs: () => [],
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const listEl = ref<HTMLElement | null>(null)

function select(key: string) {
  emit('update:modelValue', key)
}

/** Roving tabindex + arrow-key navigation (WCAG 2.2 keyboard, §22.7). */
function onKeydown(e: KeyboardEvent) {
  const keys = props.tabs.map(t => t.key)
  if (!keys.length)
    return
  const current = props.modelValue || keys[0]
  let nextIndex = keys.indexOf(current)
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = (nextIndex + 1) % keys.length
  }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = (nextIndex - 1 + keys.length) % keys.length
  }
  else if (e.key === 'Home') {
    nextIndex = 0
  }
  else if (e.key === 'End') {
    nextIndex = keys.length - 1
  }
  else {
    return
  }
  e.preventDefault()
  select(keys[nextIndex])
  // Move focus to the newly selected tab.
  listEl.value?.querySelector<HTMLElement>(`[role="tab"][data-key="${keys[nextIndex]}"]`)?.focus()
}
</script>

<template>
  <div ref="listEl" role="tablist" class="flex flex-wrap gap-1 border-b border-border" @keydown="onKeydown">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :data-key="tab.key"
      :aria-selected="modelValue === tab.key"
      :tabindex="modelValue === tab.key ? 0 : -1"
      class="rounded-t px-3 py-2 text-sm transition-colors"
      :class="modelValue === tab.key ? 'border-b-2 border-accent font-medium text-foreground' : 'text-muted hover:text-foreground'"
      @click="select(tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
