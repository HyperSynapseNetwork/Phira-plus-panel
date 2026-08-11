<script setup lang="ts">
import { computed } from 'vue'
import { fetchJobs, fetchLogs, fetchServerStatus } from '~/api/admin'
import AlertCard from '~/components/admin/AlertCard.vue'
import AsyncState from '~/components/admin/AsyncState.vue'
import ChartCard from '~/components/admin/ChartCard.vue'
import KpiCard from '~/components/admin/KpiCard.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import { useAsync } from '~/composables/useAsync'
import { formatDuration, formatNumber, timeAgo } from '~/utils/format'

definePageMeta({ permissions: ['dashboard:view'] })

const server = useAsync(() => fetchServerStatus())
const logs = useAsync(() => fetchLogs({ level: 'warn,error', pageNum: 200 }))
const jobs = useAsync(() => fetchJobs({ pageNum: 50 }))

interface AggregatedAlert {
  level: 'warn' | 'error'
  errorCode: string
  message: string
  count: number
  lastTs: string
  logId: string
}

const alerts = computed<AggregatedAlert[]>(() => {
  const entries = logs.data.value?.items ?? []
  const map = new Map<string, AggregatedAlert>()
  for (const e of entries) {
    if (e.level !== 'warn' && e.level !== 'error')
      continue
    const key = e.error_code ?? e.event ?? e.message.slice(0, 48)
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      if (e.timestamp > existing.lastTs) {
        existing.lastTs = e.timestamp
        existing.logId = e.log_id
      }
    }
    else {
      map.set(key, {
        level: e.level as 'warn' | 'error',
        errorCode: e.error_code ?? '-',
        message: e.message,
        count: 1,
        lastTs: e.timestamp,
        logId: e.log_id,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.lastTs.localeCompare(a.lastTs)).slice(0, 8)
})

const status = computed(() => server.data.value)
const errorCount = computed(() => (logs.data.value?.items ?? []).filter(e => e.level === 'error').length)

const onlineSeries = computed<Array<[string, number]>>(() =>
  (status.value?.metrics ?? []).map(m => [m.t, m.online] as [string, number]),
)
const roomSeries = computed<Array<[string, number]>>(() =>
  (status.value?.metrics ?? []).map(m => [m.t, m.rooms] as [string, number]),
)

const healthTone = computed<'success' | 'danger' | 'neutral'>(() => {
  if (status.value?.pmp?.connected === true)
    return 'success'
  if (server.error.value)
    return 'neutral'
  return 'danger'
})

const activeJobs = computed(() => (jobs.data.value?.items ?? []).filter(j => j.state === 'running' || j.state === 'queued').length)
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="仪表盘" subtitle="运营概览 · 摘要卡片点击进入对应模块">
      <template #actions>
        <span class="text-xs text-muted">数据来源：PPB（未就绪时显示占位）</span>
      </template>
    </PageHeader>

    <!-- Operational Alerts (§18.1) -->
    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          Operational Alerts
        </h3>
        <NuxtLink to="/logs" class="text-xs text-muted hover:text-foreground">
          全部日志 →
        </NuxtLink>
      </div>
      <AsyncState
        :loading="logs.loading.value"
        :error="logs.error.value"
        :empty="alerts.length === 0"
        empty-text="暂无 WARN/ERROR 告警"
      >
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <AlertCard
            v-for="a in alerts"
            :key="a.logId"
            :level="a.level"
            :error-code="a.errorCode"
            :message="a.message"
            :count="a.count"
            :last-seen-ago="timeAgo(a.lastTs)"
            :log-id="a.logId"
          />
        </div>
      </AsyncState>
    </section>

    <!-- KPI / summary (§18.1) -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="在线用户"
        :value="formatNumber(status?.counts.users)"
        :hint="status ? `PMP ${status.pmp.connected ? '已连接' : '未连接'}` : 'PPB 未就绪'"
        :tone="status?.pmp.connected ? 'success' : 'neutral'"
      />
      <KpiCard label="房间" :value="formatNumber(status?.counts.rooms)" hint="当前房间数" />
      <KpiCard label="会话" :value="formatNumber(status?.counts.sessions)" hint="活动 Session" />
      <KpiCard label="最近错误" :value="formatNumber(errorCount)" hint="近 200 条日志中 ERROR 数" :tone="errorCount > 0 ? 'danger' : 'success'" />
      <KpiCard label="服务器健康" :value="healthTone === 'success' ? '正常' : healthTone === 'danger' ? '异常' : '未知'" :tone="healthTone" hint="PMP 连接状态" />
      <KpiCard label="PMP 运行时长" :value="formatDuration(status?.pmp.uptime_secs)" hint="PMP uptime" />
      <KpiCard label="活跃任务" :value="formatNumber(activeJobs)" hint="running/queued" />
      <KpiCard label="插件" :value="formatNumber(status?.counts.plugins)" hint="已加载插件数" />
    </div>

    <!-- Chart summaries (§18.2) — chart type/range remembered in panel prefs -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="在线用户趋势" chart-id="online_users" :data="onlineSeries" />
      <ChartCard title="房间趋势" chart-id="rooms" :data="roomSeries" />
    </div>

    <AsyncState :loading="server.loading.value" :error="server.error.value" :empty="false">
      <p class="text-xs text-muted">
        服务器运行时：CPU {{ status?.runtime?.cpu_percent ?? '—' }}% · 内存
        {{ status?.runtime?.memory_mb ? `${status.runtime.memory_mb} MB` : '—' }} · 磁盘
        {{ status?.runtime?.disk_percent ?? '—' }}%
      </p>
    </AsyncState>
  </div>
</template>
