<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string
  label?: string
  options?: Array<{ label: string, value: string }>
  placeholder?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  label: '',
  options: () => [],
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-sm font-medium text-foreground">{{ label }}</span>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="w-full rounded border border-border bg-field px-3 py-2 text-sm text-field-foreground outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      @change="onChange"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </label>
</template>
