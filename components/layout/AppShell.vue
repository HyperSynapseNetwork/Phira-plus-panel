<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'

const sidebarCollapsed = ref(false)
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
