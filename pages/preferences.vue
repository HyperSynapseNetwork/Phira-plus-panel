<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPSection from '~/components/patterns/PPSection.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPSwitch from '~/components/ui/PPSwitch.vue'
import { useCommonAppearance } from '~/composables/useCommonAppearance'
import { usePreferencesStore } from '~/stores/preferences'

definePageMeta({ permissions: ['preference:manage'] })
const prefs = usePreferencesStore()
const appearance = useCommonAppearance()
const notice = useNotice()
const { locale, t, setLocale } = usePanelI18n()
const busy = ref(false)

onMounted(() => {
  if (!prefs.loaded) void prefs.load()
  if (!appearance.loaded.value) void appearance.load()
})

async function saveAll(): Promise<void> {
  busy.value = true
  try {
    await Promise.all([prefs.save(), appearance.save()])
    notice.success('notice.saved', { dedupKey: 'panel-preferences:save' })
  }
  catch (err) { notice.errorFromApi(err, { dedupKey: 'panel-preferences:save:error' }) }
  finally { busy.value = false }
}
async function changeLanguage(value: string): Promise<void> {
  if (value !== 'zh' && value !== 'en') return
  try { await setLocale(value); notice.success('notice.languageChanged', { dedupKey: 'panel:language' }) }
  catch (err) { notice.errorFromApi(err, { dedupKey: 'panel:language:error' }) }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <PageHeader :title="t('preferences.title')" :subtitle="t('preferences.subtitle')">
      <template #actions><PPButton size="sm" weight="primary" :disabled="busy" @click="saveAll">{{ t('preferences.save') }}</PPButton></template>
    </PageHeader>
    <div class="flex flex-wrap items-center gap-2">
      <PPStatus v-if="prefs.loadError" tone="warning">{{ t('preferences.syncMissing') }}</PPStatus>
      <PPBadge v-else-if="prefs.loaded" tone="neutral">{{ t('preferences.revision', { revision: prefs.revision }) }}</PPBadge>
      <PPStatus v-if="appearance.syncStatus.value === 'synced'" tone="success">{{ t('preferences.appearanceSynced') }}</PPStatus>
      <PPStatus v-else-if="appearance.syncStatus.value === 'unavailable'" tone="warning">{{ t('preferences.appearanceSyncUnavailable') }}</PPStatus>
      <PPBadge v-else tone="neutral">{{ t('preferences.appearanceDeviceOnly') }}</PPBadge>
    </div>

    <PPSection :title="t('preferences.appearance')" :subtitle="t('preferences.appearanceHint')">
      <div class="grid gap-3 sm:grid-cols-2">
        <PPSelect :model-value="locale" :label="t('common.language')" :options="[{ label: t('common.zh'), value: 'zh' }, { label: t('common.en'), value: 'en' }]" @update:model-value="changeLanguage" />
        <div class="rounded-[var(--pp-radius-control)] border border-border px-3 py-2.5">
          <p class="text-xs text-muted">{{ t('preferences.theme') }}</p>
          <p class="mt-1 text-sm text-foreground">{{ t('preferences.themeDark') }}</p>
          <p class="mt-1 text-xs text-muted">{{ t('preferences.themeDarkOnlyHint') }}</p>
        </div>
        <PPSelect v-model="appearance.value.value.accent" :label="t('preferences.accent')" :options="[{label:'Cyan',value:'cyan'},{label:'Blue',value:'blue'},{label:'Violet',value:'violet'},{label:'Green',value:'green'},{label:'Amber',value:'amber'}]" />
        <div class="space-y-3 sm:pt-6"><PPSwitch v-model="appearance.value.value.reducedMotion" :label="t('preferences.reducedMotion')" /><PPSwitch v-model="appearance.value.value.reducedTransparency" :label="t('preferences.reducedTransparency')" /></div>
      </div>
    </PPSection>

    <PPSection :title="t('preferences.workspace')">
      <div class="flex items-center justify-between gap-4"><div><p class="text-sm text-foreground">{{ t('preferences.sidebarCollapsed') }}</p><p class="mt-0.5 text-xs text-muted">{{ t('preferences.sidebarHint') }}</p></div><PPSwitch v-model="prefs.data.sidebar.collapsed" /></div>
    </PPSection>

    <PPSection :title="t('preferences.charts')" :subtitle="t('preferences.chartHint')">
      <p v-if="!Object.keys(prefs.data.per_chart_type).length" class="text-sm text-muted">{{ t('preferences.noChartPrefs') }}</p>
      <div v-else class="divide-y divide-border border-y border-border">
        <div v-for="(kind, chartId) in prefs.data.per_chart_type" :key="chartId" class="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:items-center">
          <span class="truncate text-sm text-foreground">{{ chartId }}</span>
          <PPSelect :model-value="kind" :options="[{ label: t('preferences.line'), value: 'line' },{ label: t('preferences.bar'), value: 'bar' },{ label: t('preferences.pie'), value: 'pie' }]" @update:model-value="v => prefs.update({ per_chart_type: { ...prefs.data.per_chart_type, [chartId]: v as 'line' | 'bar' | 'pie' } })" />
          <PPSelect :model-value="prefs.data.per_chart_range[chartId] ?? '24h'" :options="[{label:'24h',value:'24h'},{label:'7d',value:'7d'},{label:'30d',value:'30d'}]" @update:model-value="v => prefs.update({ per_chart_range: { ...prefs.data.per_chart_range, [chartId]: v } })" />
        </div>
      </div>
    </PPSection>

    <PPSection :title="t('preferences.performance')">
      <div class="flex items-center justify-between gap-4"><div><p class="text-sm text-foreground">{{ t('preferences.lowPerformance') }}</p><p class="mt-0.5 text-xs text-muted">{{ t('preferences.lowPerformanceHint') }}</p></div><PPSwitch v-model="prefs.data.low_performance" /></div>
    </PPSection>

    <PPSection :title="t('preferences.experimental')">
      <div class="flex items-center justify-between gap-4"><div><p class="text-sm text-foreground">{{ t('preferences.desktopWindow') }}</p><p class="mt-0.5 text-xs text-muted">{{ t('preferences.desktopWindowHint') }}</p></div><PPSwitch v-model="prefs.data.desktop_window.enabled" /></div>
    </PPSection>
  </div>
</template>
