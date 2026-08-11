<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <header class="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
    <div class="text-sm text-muted">
      运营控制台
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
        type="button"
        class="text-sm text-muted transition-colors hover:text-foreground"
        @click="handleLogout"
      >
        退出
      </button>
    </div>
  </header>
</template>
