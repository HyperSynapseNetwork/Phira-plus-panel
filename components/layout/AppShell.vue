<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCommonAppearance } from '~/composables/useCommonAppearance'
import { focusableElements, trapTab, useOverlayManager } from '~/composables/useOverlayManager'
import { usePreferencesStore } from '~/stores/preferences'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'

const prefs = usePreferencesStore()
const appearance = useCommonAppearance()
const route = useRoute()
const { t } = usePanelI18n()
const mobileOpen = ref(false)
const drawerEl = ref<HTMLElement | null>(null)
const overlay = useOverlayManager()
const drawerOverlayId = 'panel-mobile-drawer'
function onDrawerKey(event: KeyboardEvent) {
  if (!mobileOpen.value || !overlay.isTopmost(drawerOverlayId))
    return
  if (event.key === 'Escape') { event.preventDefault(); mobileOpen.value = false; return }
  trapTab(event, drawerEl.value)
}

const sidebarCollapsed = computed({
  get: () => prefs.data.sidebar.collapsed,
  set: v => prefs.update({ sidebar: { collapsed: v } }),
})

onMounted(() => {
  if (!prefs.loaded)
    void prefs.load()
  if (!appearance.loaded.value)
    void appearance.load()
})
watch(() => route.path, () => { mobileOpen.value = false })
watch(mobileOpen, async (open) => {
  if (!import.meta.client)
    return
  if (open) { overlay.push(drawerOverlayId, 'drawer'); await nextTick(); (focusableElements(drawerEl.value)[0] ?? drawerEl.value)?.focus({ preventScroll: true }) }
  else {
    overlay.pop(drawerOverlayId)
  }
})
onMounted(() => {
  if (import.meta.client)
    window.addEventListener('keydown', onDrawerKey)
})
onBeforeUnmount(() => {
  if (import.meta.client)
    window.removeEventListener('keydown', onDrawerKey); overlay.pop(drawerOverlayId)
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <div class="hidden shrink-0 lg:block">
      <AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    </div>

    <Transition name="drawer-fade">
      <div v-if="mobileOpen" class="fixed inset-0 z-[var(--pp-z-drawer-backdrop)] lg:hidden">
        <button class="absolute inset-0 bg-black/45" type="button" :aria-label="t('common.close')" @click="mobileOpen = false" />
        <div ref="drawerEl" tabindex="-1" class="relative z-[var(--pp-z-drawer)] h-full w-fit shadow-2xl">
          <AppSidebar :collapsed="false" mobile @navigate="mobileOpen = false" />
        </div>
      </div>
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopBar @open-menu="mobileOpen = true" />
      <main class="flex-1 overflow-auto p-3 sm:p-4">
        <slot />
      </main>
    </div>
  </div>
</template>
