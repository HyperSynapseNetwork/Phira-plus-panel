<script setup lang="ts">
import type { ChartKind } from '~/types/preferences'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { usePreferencesStore } from '~/stores/preferences'

/**
 * Dashboard chart summary card. Chart type + time range are remembered per
 * chart id in the `panel` preference namespace (§21.1 / §18.2).
 */
const props = withDefaults(defineProps<{
  title: string
  chartId: string
  data?: Array<[string, number]>
}>(), {
  data: () => [],
})

const prefs = usePreferencesStore()

const chartType = computed<ChartKind>(() => prefs.data.per_chart_type[props.chartId] ?? 'line')
const timeRange = computed<string>(() => prefs.data.per_chart_range[props.chartId] ?? '24h')

function setChartType(type: ChartKind) {
  prefs.update({ per_chart_type: { ...prefs.data.per_chart_type, [props.chartId]: type } })
}

const option = computed(() => {
  const data = props.data
  if (chartType.value === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data.map(([name, value]) => ({ name, value })),
      }],
    }
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 24, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: data.map(([name]) => name) },
    yAxis: { type: 'value' },
    series: [{
      name: props.title,
      type: chartType.value === 'bar' ? 'bar' : 'line',
      data: data.map(([, value]) => value),
      smooth: true,
    }],
  }
})

const empty = computed(() => props.data.length === 0)
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <header class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-sm font-medium text-foreground">
        {{ title }}
      </h3>
      <div class="flex items-center gap-1 text-[11px] text-muted">
        <select
          class="rounded border border-border bg-field px-1 py-0.5 text-[11px]"
          :value="chartType"
          aria-label="图表类型"
          @change="setChartType(($event.target as HTMLSelectElement).value as ChartKind)"
        >
          <option value="line">
            折线
          </option>
          <option value="bar">
            柱状
          </option>
          <option value="pie">
            饼图
          </option>
        </select>
        <span>{{ timeRange }}</span>
      </div>
    </header>
    <VChart v-if="!empty" class="h-48 w-full" :option="option" autoresize />
    <p v-else class="py-10 text-center text-sm text-muted">
      暂无数据（PPB 未就绪或该时段无数据）
    </p>
  </section>
</template>
