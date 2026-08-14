<script setup lang="ts">
import { useHead } from 'nuxt/app'

const { locale } = usePanelI18n()
useHead(() => ({
  title: 'Phira+ Panel',
  htmlAttrs: { lang: locale.value === 'en' ? 'en' : 'zh-CN' },
  meta: [{ name: 'robots', content: 'noindex,nofollow,noarchive,nosnippet,noimageindex' }],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <PPNoticeHost />
</template>
