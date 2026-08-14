<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ADMIN_NAVIGATION } from '~/config/admin-navigation'
import { useAuthStore } from '~/stores/auth'
import PPIcon from '~/components/ui/PPIcon.vue'

const props = withDefaults(defineProps<{ collapsed: boolean, mobile?: boolean }>(), { mobile: false })
const emit = defineEmits<{ toggle: [], navigate: [] }>()
const auth = useAuthStore()
const route = useRoute()
const { t } = usePanelI18n()
const opened = ref<Set<string>>(new Set())

function isActive(item: { to: string, exact?: boolean }): boolean {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}
const sections = computed(() => ADMIN_NAVIGATION.map(section => ({
  ...section,
  items: section.items.filter(item => auth.hasPermission(item.permissions)),
})).filter(section => section.items.length))
function activeSectionKeys(): string[] {
  return sections.value.filter(section => section.items.some(isActive)).map(section => section.titleKey)
}
function toggleSection(key: string): void {
  const next = new Set(opened.value)
  next.has(key) ? next.delete(key) : next.add(key)
  opened.value = next
}
function sectionOpen(key: string): boolean {
  return props.mobile || opened.value.has(key) || activeSectionKeys().includes(key)
}
watch(() => route.path, () => {
  const next = new Set(opened.value)
  activeSectionKeys().forEach(key => next.add(key))
  opened.value = next
}, { immediate: true })
</script>

<template>
  <aside
    class="flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200 ease-smooth"
    :class="props.mobile ? 'w-[min(19rem,86vw)]' : props.collapsed ? 'w-14' : 'w-60'"
  >
    <div class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      <span class="inline-block size-2 rounded-full bg-accent" />
      <span v-if="props.mobile || !props.collapsed" class="text-sm font-semibold text-foreground">Phira+ Panel</span>
    </div>
    <nav class="flex-1 overflow-y-auto p-2" :aria-label="t('nav.management')">
      <div v-for="section in sections" :key="section.titleKey" class="mb-2">
        <button
          v-if="props.mobile || !props.collapsed"
          type="button"
          class="flex w-full items-center justify-between rounded px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted hover:bg-surface-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          :aria-expanded="sectionOpen(section.titleKey)"
          @click="toggleSection(section.titleKey)"
        >
          <span>{{ t(section.titleKey) }}</span>
          <PPIcon name="chevron" :size="13" class="transition-transform duration-200" :class="sectionOpen(section.titleKey) ? 'rotate-90' : ''" />
        </button>
        <Transition name="sidebar-section">
          <ul v-show="props.collapsed || sectionOpen(section.titleKey)" class="mt-1 space-y-1">
            <li v-for="item in section.items" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex min-h-11 items-center gap-2 rounded px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                :class="isActive(item) ? 'bg-accent-soft text-accent' : 'text-foreground hover:bg-surface-secondary'"
                :title="!props.mobile && props.collapsed ? t(item.labelKey) : undefined"
                :aria-label="!props.mobile && props.collapsed ? t(item.labelKey) : undefined"
                @click="emit('navigate')"
              >
                <PPIcon :name="item.icon" :size="17" class="shrink-0" />
                <span v-if="props.mobile || !props.collapsed" class="truncate">{{ t(item.labelKey) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </Transition>
      </div>
    </nav>
    <div v-if="!props.mobile" class="shrink-0 border-t border-border p-2">
      <button type="button" class="flex min-h-11 w-full items-center justify-center rounded px-2 text-sm text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" :aria-label="t('nav.management')" @click="emit('toggle')">
        <PPIcon name="chevron" :size="16" :class="props.collapsed ? '' : 'rotate-180'" />
      </button>
    </div>
  </aside>
</template>
