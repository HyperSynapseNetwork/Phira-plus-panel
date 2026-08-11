<script setup lang="ts">
import { usePermissionsStore } from '~/stores/permissions'

/**
 * Manifest-driven permission picker (§5 / §8.2). Renders permissions grouped
 * by manifest `group`; the full set is never hardcoded. `root_only` entries
 * are shown but locked for non-root groups.
 */
const props = withDefaults(defineProps<{
  modelValue?: string[]
  readonly?: boolean
  disabled?: boolean
}>(), {
  modelValue: () => [],
  readonly: false,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const store = usePermissionsStore()

function toggle(id: string) {
  if (props.readonly || props.disabled)
    return
  const set = new Set(props.modelValue)
  if (set.has(id))
    set.delete(id)
  else
    set.add(id)
  emit('update:modelValue', [...set])
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="store.error" class="text-sm text-danger">
      权限 Manifest 不可用（PPB 未就绪），无法渲染权限树。
    </p>
    <div v-for="group in store.groups" :key="group" class="rounded border border-border p-3">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        {{ group }}
      </p>
      <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <label
          v-for="p in store.byGroup(group)"
          :key="p.id"
          class="flex items-center gap-2 text-sm text-foreground"
        >
          <input
            type="checkbox"
            :checked="modelValue.includes(p.id)"
            :disabled="readonly || disabled || p.root_only"
            class="rounded"
            @change="toggle(p.id)"
          >
          <span>{{ p.label }}</span>
          <span v-if="p.root_only" class="text-[10px] text-danger">ROOT ONLY</span>
        </label>
      </div>
    </div>
    <p v-if="!store.groups.length && !store.error" class="text-sm text-muted">
      暂无权限数据（Manifest 未加载或为空）。
    </p>
  </div>
</template>
