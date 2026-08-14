<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DesktopWindow from '~/components/experimental/DesktopWindow.vue'
import PPIcon from '~/components/ui/PPIcon.vue'
import { ADMIN_NAVIGATION } from '~/config/admin-navigation'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'

const emit = defineEmits<{ 'open-menu': [] }>()
const auth = useAuthStore()
const { t } = usePanelI18n()
const prefs = usePreferencesStore()
const route = useRoute()

const current = computed(() => {
  for (const section of ADMIN_NAVIGATION) {
    const item = section.items.find(i => i.exact ? route.path === i.to : route.path.startsWith(i.to))
    if (item) return { section: section.titleKey, item: item.labelKey }
  }
  return { section: 'nav.management', item: '' }
})

async function handleLogout() {
  await auth.logout()
  await navigateTo('/login')
}

interface DeskWin { id: number, title: string }
const isAndroid = computed(() => /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''))
const dwEnabled = computed(() => prefs.data.desktop_window.enabled)
const showDw = computed(() => dwEnabled.value && !isAndroid.value)
const wins = ref<DeskWin[]>([])
const layerMap = ref<Record<number, number>>({})
const focusOrder = ref<number[]>([])
let nextWinId = 1

onMounted(() => { if (!prefs.loaded) void prefs.load() })
watch(showDw, (on) => { if (!on) { wins.value = []; layerMap.value = {}; focusOrder.value = [] } })
function openWindow() { const w = { id: nextWinId, title: t('topbar.desktopWindowTitle', { id: nextWinId }) }; nextWinId += 1; wins.value.push(w); focusWindow(w.id) }
function closeWindow(id: number) { wins.value = wins.value.filter(w => w.id !== id); focusOrder.value = focusOrder.value.filter(x => x !== id); rebuildLayers() }
function rebuildLayers() { layerMap.value = Object.fromEntries(focusOrder.value.map((id, index) => [id, Math.min(index, 15)])) }
function focusWindow(id: number) { focusOrder.value = [...focusOrder.value.filter(x => x !== id), id]; rebuildLayers() }
</script>

<template>
  <header class="flex h-12 shrink-0 items-center justify-between border-b border-border bg-[var(--pp-material-regular)] px-3 backdrop-blur-md backdrop-saturate-150 sm:px-4">
    <div class="flex min-w-0 items-center gap-2">
      <button type="button" data-pp-touch-critical="mobile-drawer-toggle" class="pp-touch-target inline-flex size-11 items-center justify-center rounded text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden" :aria-label="t('nav.management')" @click="emit('open-menu')">
        <PPIcon name="menu" />
      </button>
      <div class="min-w-0 text-sm">
        <span class="hidden text-muted sm:inline">{{ t(current.section) }} / </span>
        <span class="truncate font-medium text-foreground">{{ current.item ? t(current.item) : t(current.section) }}</span>
        <span v-if="dwEnabled" class="ml-2 text-[10px] text-warning">{{ t('topbar.experiment') }}</span>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      <span v-if="auth.isRoot" class="rounded bg-danger px-1.5 py-0.5 text-[10px] font-medium text-danger-foreground">ROOT</span>
      <button v-if="showDw" type="button" class="pp-touch-target hidden rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-foreground md:inline-flex" :title="t('topbar.desktopWindowTooltip')" @click="openWindow">{{ t('topbar.desktopWindow') }}</button>
      <button type="button" data-pp-touch-critical="sign-out" class="pp-touch-target inline-flex size-11 items-center justify-center rounded text-muted transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" :aria-label="t('topbar.signOut')" @click="handleLogout">
        <PPIcon name="logout" :size="18" />
      </button>
    </div>
  </header>

  <DesktopWindow v-for="w in wins" :id="String(w.id)" :key="w.id" :title="w.title" :layer-index="layerMap[w.id] ?? 0" @close="closeWindow(w.id)" @focus="focusWindow(w.id)">
    <p class="text-muted">{{ t('topbar.desktopWindowHint') }}</p>
    <div class="mt-2 flex flex-wrap gap-2"><NuxtLink to="/rooms" class="text-xs text-accent hover:underline">{{ t('topbar.rooms') }}</NuxtLink><NuxtLink to="/server" class="text-xs text-accent hover:underline">{{ t('topbar.server') }}</NuxtLink><NuxtLink to="/logs" class="text-xs text-accent hover:underline">{{ t('topbar.logs') }}</NuxtLink></div>
  </DesktopWindow>
</template>
