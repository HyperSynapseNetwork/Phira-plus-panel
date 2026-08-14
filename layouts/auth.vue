<script setup lang="ts">
const { t } = usePanelI18n()
</script>
<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-md">
      <header class="mb-8 text-center">
        <h1 class="text-xl font-semibold text-foreground">Phira+ Panel</h1>
        <p class="mt-1 text-sm text-muted">{{ t('auth.subtitle') }}</p>
      </header>
      <main class="rounded-lg border border-border bg-surface p-6 shadow-surface"><slot /></main>
      <footer class="mt-6 text-center text-xs text-muted">{{ t('auth.noindex') }}</footer>
    </div>
  </div>
</template>
