<script setup lang="ts">
// Noindex meta also lives in nuxt.config app.head (rendered into the initial
// HTML shell). This useHead is an explicit, visible guard for §23.2 #2.
import { useHead } from 'nuxt/app'

useHead({
  title: 'Phira+ Panel',
  htmlAttrs: { lang: 'zh-CN' },
  meta: [
    { name: 'robots', content: 'noindex,nofollow,noarchive,nosnippet,noimageindex' },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
