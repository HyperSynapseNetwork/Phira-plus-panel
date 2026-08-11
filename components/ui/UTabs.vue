<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string
  tabs?: Array<{ key: string, label: string }>
}>(), {
  modelValue: '',
  tabs: () => [],
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="flex flex-wrap gap-1 border-b border-border">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="rounded-t px-3 py-2 text-sm transition-colors"
      :class="modelValue === tab.key ? 'border-b-2 border-accent font-medium text-foreground' : 'text-muted hover:text-foreground'"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
