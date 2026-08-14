<script setup lang="ts">
import type { ChartKind } from '~/types/preferences'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { usePreferencesStore } from '~/stores/preferences'

/**
 * Dashboard chart summary card. Chart type + time range are remembered per
 * chart id in the `panel` preference namespace (§21.1 / §18.2).
 * Animations are disabled under low-performance mode (§22.8) or the OS
 * reduced-motion setting (§22.7).
 */
const props = withDefaults(defineProps<{
  title: string
  chartId: string
  data?: Array<[string, number]>
}>(), {
  data: () => [],
})

const prefs = usePreferencesStore()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

const chartType = computed<ChartKind>(() => prefs.data.per_chart_type[props.chartId] ?? 'line')
const timeRange = computed<string>(() => prefs.data.per_chart_range[props.chartId] ?? '24h')
const noAnimation = computed(() => prefs.data.low_performance || reducedMotion.value)

function setChartType(type: ChartKind) {
  prefs.update({ per_chart_type: { ...prefs.data.per_chart_type, [props.chartId]: type } })
}

const option = computed(() => {
  const data = props.data
  if (chartType.value === 'pie') {
    return {
      animation: !noAnimation.value,
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data.map(([name, value]) => ({ name, value })),
      }],
    }
  }
  return {
    animation: !noAnimation.value,
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 24, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: data.map(([name]) => name) },
    yAxis: { type: 'value' },
    series: [{
      name: props.title,
      type: chartType.value === 'bar' ? 'bar' : 'line',
      data: data.map(([, value]) => value),
      smooth: !noAnimation.value,
    }],
  }
})

const empty = computed(() => props.data.length === 0)

const { t } = usePanelI18n()
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <header class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-sm font-medium text-foreground">
        {{ title }}
      </h3>
      <div class="flex items-center gap-1 text-[11px] text-muted">
        <PPSelect
          :model-value="chartType"
          compact
          class="w-24"
          :aria-label="t('chartCard.type')"
          @update:model-value="value => setChartType(value as ChartKind)"
        >
          <option value="line">
            {{ t('chartCard.line') }}
          </option>
          <option value="bar">
            {{ t('chartCard.bar') }}
          </option>
          <option value="pie">
            {{ t('chartCard.pie') }}
          </option>
        </PPSelect>
        <span>{{ timeRange }}</span>
      </div>
    </header>
    <VChart v-if="!empty" class="h-48 w-full" :option="option" autoresize />
    <p v-else class="py-10 text-center text-sm text-muted">
      {{ t('chartCard.noData') }}
    </p>
  </section>
</template>
