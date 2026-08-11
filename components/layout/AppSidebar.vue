<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ADMIN_NAVIGATION } from '~/config/admin-navigation'
import { useAuthStore } from '~/stores/auth'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const auth = useAuthStore()
const route = useRoute()

const sections = computed(() =>
  ADMIN_NAVIGATION
    .map(section => ({
      title: section.title,
      items: section.items.filter(item => auth.hasPermission(item.permissions)),
    }))
    .filter(section => section.items.length > 0),
)
</script>

<template>
  <aside
    class="flex flex-col border-r border-border bg-surface transition-[width] duration-200 ease-smooth"
    :class="collapsed ? 'w-14' : 'w-60'"
  >
    <div class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      <span class="inline-block size-2 rounded-full bg-accent" />
      <span v-if="!collapsed" class="text-sm font-semibold text-foreground">Phira+ Panel</span>
    </div>

    <nav class="flex-1 overflow-y-auto p-2" aria-label="管理导航">
      <div v-for="section in sections" :key="section.title" class="mb-3">
        <p
          v-if="!collapsed"
          class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          {{ section.title }}
        </p>
        <ul class="space-y-1">
          <li v-for="item in section.items" :key="item.to">
            <NuxtLink
              :to="item.disabled ? undefined : item.to"
              class="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
              :class="[
                route.path === item.to
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-surface-secondary',
                item.disabled ? 'cursor-not-allowed opacity-50' : '',
              ]"
              :aria-disabled="item.disabled || undefined"
              @click="item.disabled && $event.preventDefault()"
            >
              <span :class="collapsed ? 'mx-auto' : ''">{{ item.label }}</span>
              <span
                v-if="item.badge && !collapsed"
                class="rounded bg-warning px-1 text-[10px] leading-4 text-warning-foreground"
              >
                {{ item.badge }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="shrink-0 border-t border-border p-2">
      <button
        type="button"
        class="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-secondary"
        @click="emit('toggle')"
      >
        {{ collapsed ? '»' : '收起侧栏' }}
      </button>
    </div>
  </aside>
</template>
