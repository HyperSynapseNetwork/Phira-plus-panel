<script setup lang="ts">
import { useHead } from 'nuxt/app'

// SPA catch-all 404 — stays noindex (§23.2).
definePageMeta({ requiresAuth: false })

useHead({
  title: '页面不存在 · Phira+ Panel',
  meta: [
    { name: 'robots', content: 'noindex,nofollow,noarchive,nosnippet,noimageindex' },
  ],
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <p class="text-sm font-medium text-danger">
      404
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-foreground">
      页面不存在
    </h1>
    <p class="mt-2 text-sm text-muted">
      该页面不存在或已被移除。
    </p>
    <NuxtLink
      to="/"
      class="mt-6 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
    >
      返回仪表盘
    </NuxtLink>
  </div>
</template>
