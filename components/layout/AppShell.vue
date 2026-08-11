<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePreferencesStore } from '~/stores/preferences'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'

/**
 * Shell layout. Sidebar collapse state lives in the `panel` preference
 * namespace (§21.1 sidebar) so it survives across devices; local toggle is
 * applied immediately and synced to PPB on the preferences page.
 */
const prefs = usePreferencesStore()

const sidebarCollapsed = computed({
  get: () => prefs.data.sidebar.collapsed,
  set: v => prefs.update({ sidebar: { collapsed: v } }),
})

onMounted(() => {
  if (!prefs.loaded)
    void prefs.load()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopBar />
      <main class="flex-1 overflow-auto p-4">
        <slot />
      </main>
    </div>
  </div>
</template>
