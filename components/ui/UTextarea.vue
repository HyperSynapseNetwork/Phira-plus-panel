<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string
  label?: string
  name?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  mono?: boolean
}>(), {
  modelValue: '',
  label: '',
  name: undefined,
  placeholder: '',
  rows: 4,
  disabled: false,
  mono: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-sm font-medium text-foreground">{{ label }}</span>
    <textarea
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      class="w-full rounded border border-border bg-field px-3 py-2 text-field-foreground outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50" :class="[mono ? 'font-mono text-xs' : 'text-sm']"
      @input="onInput"
    />
  </label>
</template>
