<script setup lang="ts">
import { useHead } from 'nuxt/app'

defineProps<{
  error?: {
    statusCode?: number
    statusMessage?: string
  } | null
}>()

const { t } = usePanelI18n()

// Error/fallback page must stay noindex (§23.2 #7).
useHead({
  meta: [
    { name: 'robots', content: 'noindex,nofollow,noarchive,nosnippet,noimageindex' },
  ],
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
    <p class="text-sm font-medium text-danger">
      {{ error?.statusCode ?? t('common.error') }}
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-foreground">
      {{ t('notFoundPage.title') }}
    </h1>
    <p class="mt-2 text-sm text-muted">
      {{ t('notFoundPage.description') }}
    </p>
    <NuxtLink
      to="/"
      class="mt-6 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
    >
      {{ t('notFoundPage.back') }}
    </NuxtLink>
  </div>
</template>
