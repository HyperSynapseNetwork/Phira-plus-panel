<script setup lang="ts">
import { inputVariants } from '@heroui/styles'
import { computed } from 'vue'

/**
 * Internal HeroUI styles are hidden behind the public Phira+ input primitive (design §3.4).
 * Uses `@heroui/styles` `inputVariants()`.
 */
withDefaults(defineProps<{
  modelValue?: string
  type?: string
  label?: string
  name?: string
  placeholder?: string
  autocomplete?: string
  disabled?: boolean
  required?: boolean
}>(), {
  modelValue: '',
  type: 'text',
  label: '',
  name: undefined,
  placeholder: '',
  autocomplete: undefined,
  disabled: false,
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string], 'blur': [FocusEvent] }>()

const classes = computed(() => inputVariants({ variant: 'primary' }))

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onBlur(event: FocusEvent) {
  emit('blur', event)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-sm font-medium text-foreground">{{ label }}</span>
    <input
      :type="type"
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :required="required"
      class="pp-touch-target" :class="[classes]"
      @input="onInput"
      @blur="onBlur"
    >
  </label>
</template>
