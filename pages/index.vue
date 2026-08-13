<script setup lang="ts">
import { computed } from 'vue'
import { fetchJobs, fetchLogs, fetchServerStats, fetchServerStatus } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import { useAsync } from '~/composables/useAsync'
import { formatNumber, timeAgo } from '~/utils/format'

definePageMeta({ permissions: ['dashboard:view'] })

const server = useAsync(() => fetchServerStatus())
const stats = useAsync(() => fetchServerStats())
const logs = useAsync(() => fetchLogs({ level: 'warn,error', pageNum: 100 }))
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

const healthTone = computed<'live' | 'error' | 'warning'>(() => {
  if (status.value?.pmp?.connected === true)
    return 'live'
  if (server.error.value)
    return 'warning'
  return 'error'
})

const activeJobs = computed(() => (jobs.data.value?.items ?? []).filter(j => j.state === 'running' || j.state === 'queued').length)
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-lg font-semibold text-foreground">
      仪表盘
    </h1>

    <!-- 服务器状态条（单行，非 KPI 方块） -->
    <section class="flex items-center gap-3 rounded-[var(--pp-radius-surface)] border border-border bg-surface px-4 py-3">
      <PPStatus :tone="healthTone">
        {{ healthTone === 'live' ? '运行中' : healthTone === 'error' ? '异常' : '未知' }}
      </PPStatus>
      <div class="text-sm">
        <span class="text-foreground">{{ formatNumber(stats.data.value?.users_online) }}</span>
        <span class="text-muted"> 在线</span>
        <span class="text-muted"> · </span>
        <span class="text-foreground">{{ formatNumber(stats.data.value?.active_rooms) }}</span>
        <span class="text-muted"> 房间</span>
      </div>
      <span class="ml-auto text-xs text-muted">
        PMP {{ status?.pmp?.connected ? '已连接' : '未连接' }}
      </span>
    </section>

    <!-- 运行告警（列表，非卡片网格） -->
    <section>
      <div class="mb-1 flex items-center justify-between">
        <h2 class="text-xs font-medium uppercase tracking-wide text-muted">
          运行告警
        </h2>
        <NuxtLink to="/logs" class="text-xs text-muted hover:text-foreground">
          全部日志
        </NuxtLink>
      </div>
      <AsyncState
        :loading="logs.loading.value"
        :error="logs.error.value"
        :empty="alerts.length === 0"
        empty-text="暂无告警"
      >
        <ul class="space-y-1">
          <li
            v-for="a in alerts"
            :key="a.logId"
            class="flex items-center gap-3 rounded-[var(--pp-radius-control)] px-2 py-1.5 hover:bg-surface-secondary"
          >
            <PPStatus :tone="a.level === 'error' ? 'error' : 'warning'">
              {{ a.level.toUpperCase() }}
            </PPStatus>
            <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{ a.message }}</span>
            <span class="shrink-0 text-xs text-muted">{{ a.count }} · {{ timeAgo(a.lastTs) }}</span>
          </li>
        </ul>
      </AsyncState>
    </section>

    <!-- 指标（一行，非 8 张 KPI 卡） -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <span><span class="text-foreground">{{ formatNumber(stats.data.value?.users_online) }}</span> <span class="text-muted">在线</span></span>
      <span><span class="text-foreground">{{ formatNumber(stats.data.value?.active_rooms) }}</span> <span class="text-muted">房间</span></span>
      <span><span class="text-foreground">{{ formatNumber(stats.data.value?.active_sessions) }}</span> <span class="text-muted">会话</span></span>
      <span><span class="text-foreground">{{ formatNumber(activeJobs) }}</span> <span class="text-muted">任务</span></span>
      <span><span class="text-foreground">{{ formatNumber(stats.data.value?.loaded_plugins) }}</span> <span class="text-muted">插件</span></span>
      <span v-if="errorCount > 0"><span class="text-danger">{{ errorCount }}</span> <span class="text-muted">错误</span></span>
    </div>

    <!-- 在线趋势（暂无 metrics history 数据源，诚实空置） -->
    <section class="rounded-[var(--pp-radius-surface)] border border-border bg-surface p-4">
      <h2 class="mb-2 text-sm font-medium text-foreground">在线趋势</h2>
      <p class="text-sm text-muted">暂无数据</p>
    </section>

    <!-- 最近房间（无房间列表数据源，诚实空置） -->
    <section class="rounded-[var(--pp-radius-surface)] border border-border bg-surface p-4">
      <h2 class="mb-2 text-sm font-medium text-foreground">最近房间</h2>
      <p class="text-sm text-muted">暂无房间</p>
    </section>
  </div>
</template>
