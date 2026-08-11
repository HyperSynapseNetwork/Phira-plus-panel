<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { computed, onMounted, ref, watch } from 'vue'
import DesktopWindow from '~/components/experimental/DesktopWindow.vue'
import { useAuthStore } from '~/stores/auth'
import { usePreferencesStore } from '~/stores/preferences'

const auth = useAuthStore()
const prefs = usePreferencesStore()

async function handleLogout() {
  await auth.logout()
  await navigateTo('/login')
}

// --- Experimental Desktop Window (§22.5) — preference-gated, default off. ---
interface DeskWin {
  id: number
  title: string
}

const isAndroid = computed(() => /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : ''))
const dwEnabled = computed(() => prefs.data.desktop_window.enabled)
const showDw = computed(() => dwEnabled.value && !isAndroid.value)

const wins = ref<DeskWin[]>([])
const zMap = ref<Record<number, number>>({})
let nextWinId = 1
let zTop = 100

onMounted(() => {
  if (!prefs.loaded)
    void prefs.load()
})

// When the experiment is disabled (or on Android) collapse any open windows.
watch(showDw, (on) => {
  if (!on) {
    wins.value = []
    zMap.value = {}
  }
})

function openWindow() {
  const w: DeskWin = { id: nextWinId, title: `桌面窗口 ${nextWinId}` }
  nextWinId += 1
  wins.value.push(w)
  focusWindow(w.id)
}

function closeWindow(id: number) {
  wins.value = wins.value.filter(w => w.id !== id)
  delete zMap.value[id]
}

function focusWindow(id: number) {
  zTop += 1
  zMap.value[id] = zTop
}
</script>

<template>
  <header class="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
    <div class="flex items-center gap-2 text-sm text-muted">
      运营控制台
      <span v-if="dwEnabled" class="text-[10px] text-warning">实验</span>
    </div>
    <div class="flex items-center gap-3">
      <span
        v-if="auth.isRoot"
        class="rounded bg-danger px-1.5 py-0.5 text-[10px] font-medium text-danger-foreground"
      >
        ROOT
      </span>
      <span class="text-sm text-foreground">管理员</span>
      <button
        v-if="showDw"
        type="button"
        class="rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
        title="实验性 Desktop Window（§22.5）"
        @click="openWindow"
      >
        窗口
      </button>
      <button
        type="button"
        class="text-sm text-muted transition-colors hover:text-foreground"
        @click="handleLogout"
      >
        退出
      </button>
    </div>
  </header>

  <DesktopWindow
    v-for="w in wins"
    :id="String(w.id)"
    :key="w.id"
    :title="w.title"
    :z-index="zMap[w.id] ?? 100"
    @close="closeWindow(w.id)"
    @focus="focusWindow(w.id)"
  >
    <p class="text-muted">
      桌面窗口骨架 — 拖拽标题栏移动，右下角缩放；几何位置保存在本机（§22.5 device pref）。
    </p>
    <div class="mt-2 flex flex-wrap gap-2">
      <NuxtLink to="/rooms" class="text-xs text-accent hover:underline">
        房间
      </NuxtLink>
      <NuxtLink to="/server" class="text-xs text-accent hover:underline">
        服务器
      </NuxtLink>
      <NuxtLink to="/logs" class="text-xs text-accent hover:underline">
        日志
      </NuxtLink>
    </div>
  </DesktopWindow>
</template>
