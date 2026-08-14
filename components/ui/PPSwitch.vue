<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
}>(), {
  modelValue: false,
  label: '',
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label class="inline-flex min-h-11 cursor-pointer items-center gap-2">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      :class="modelValue ? 'bg-accent' : 'bg-surface-secondary'"
      @click="toggle"
    >
      <span class="inline-block size-4 translate-x-0.5 rounded-full bg-white transition-transform" :class="modelValue ? 'translate-x-4' : 'translate-x-0.5'" />
    </button>
    <span v-if="label" class="text-sm text-foreground">{{ label }}</span>
  </label>
</template>
