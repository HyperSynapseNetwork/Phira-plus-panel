<script setup lang="ts">
import type { LogEntry } from '~/types/admin'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchLogs, translateLog } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UInput from '~/components/ui/UInput.vue'
import USelect from '~/components/ui/USelect.vue'
import { useAsync } from '~/composables/useAsync'
import { formatDateTime } from '~/utils/format'
import { localTranslate } from '~/utils/log-translator'

definePageMeta({ permissions: ['logs:view'] })

const route = useRoute()

const service = ref('')
const level = ref('')
const search = ref('')
const live = ref(false)
const focusLogId = ref('')
const focusNote = ref('')
const selected = ref<LogEntry | null>(null)
const translation = ref<ReturnType<typeof localTranslate>>(null)

let highlightTimer: ReturnType<typeof setTimeout> | null = null
let liveTimer: ReturnType<typeof setInterval> | null = null

const list = useAsync(() => fetchLogs({
  service: service.value || undefined,
  level: level.value || undefined,
  search: search.value || undefined,
  pageNum: 200,
}))

watch([service, level, search], () => {
  void list.run()
})

onMounted(() => {
  const focus = route.query.focus
  if (typeof focus === 'string') {
    focusLogId.value = focus
    void locateLog(focus)
  }
})

onBeforeUnmount(() => {
  stopLive()
})

function stopLive() {
  live.value = false
  if (liveTimer) {
    clearInterval(liveTimer)
    liveTimer = null
  }
}

function toggleLive() {
  live.value = !live.value
  if (live.value) {
    void list.run()
    liveTimer = setInterval(() => void list.run(), 3000)
  }
  else if (liveTimer) {
    clearInterval(liveTimer)
    liveTimer = null
  }
}

async function locateLog(logId: string) {
  try {
    const res = await fetchLogs({ log_id: logId, pageNum: 1 })
    const item = res.items[0]
    if (item) {
      list.data.value = { items: [item], total: 1, page: 1, pageNum: 1 }
      flash(item.log_id)
    }
    else {
      focusNote.value = `未找到日志 ${logId}`
    }
  }
  catch {
    focusNote.value = `无法定位日志 ${logId}（PPB 未就绪）`
  }
}

function flash(logId: string) {
  focusLogId.value = logId
  if (highlightTimer)
    clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    focusLogId.value = ''
  }, 3000)
}

const logs = computed<LogEntry[]>(() => list.data.value?.items ?? [])

async function openEntry(e: LogEntry) {
  selected.value = e
  translation.value = localTranslate({ error_code: e.error_code, message: e.message })
  try {
    const t = await translateLog({ error_code: e.error_code, message: e.message })
    translation.value = {
      title: t.title,
      explanation: t.explanation,
      module: t.module,
      severity: t.severity,
      suggestion: t.suggestion,
    }
  }
  catch {
    // keep local translation fallback
  }
}

const levelTone = (l: string) => (l === 'error' ? 'danger' : l === 'warn' ? 'warning' : l === 'info' ? 'accent' : 'neutral')
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="日志" subtitle="live + history · 稳定 log_id · 告警聚焦高亮 ~3s · 规则化翻译（§18.11/§19.2）">
      <template #actions>
        <UButton size="sm" variant="outline" @click="toggleLive">
          {{ live ? '停止 Live' : 'Live' }}
        </UButton>
        <UButton size="sm" variant="outline" @click="list.run()">
          刷新
        </UButton>
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="service"
        placeholder="服务"
        :options="[
          { label: 'PPB', value: 'ppb' },
          { label: 'PMP', value: 'pmp' },
          { label: 'Panel', value: 'panel' },
        ]"
      />
      <USelect
        v-model="level"
        placeholder="级别"
        :options="[
          { label: 'ERROR', value: 'error' },
          { label: 'WARN', value: 'warn' },
          { label: 'INFO', value: 'info' },
          { label: 'DEBUG', value: 'debug' },
        ]"
      />
      <UInput v-model="search" placeholder="搜索内容 / error_code" class="w-72" />
    </div>

    <p v-if="focusNote" class="text-sm text-warning">
      {{ focusNote }}
    </p>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="logs.length === 0">
          <div class="max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface">
            <table class="w-full text-left text-xs">
              <thead class="sticky top-0 bg-surface">
                <tr class="border-b border-border uppercase text-muted">
                  <th class="px-2 py-1.5">
                    时间
                  </th>
                  <th class="px-2 py-1.5">
                    级别
                  </th>
                  <th class="px-2 py-1.5">
                    服务
                  </th>
                  <th class="px-2 py-1.5">
                    消息
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="e in logs"
                  :key="e.log_id"
                  class="cursor-pointer border-b border-border last:border-0"
                  :class="[focusLogId === e.log_id ? 'bg-accent-soft' : 'hover:bg-surface-secondary']"
                  @click="openEntry(e)"
                >
                  <td class="whitespace-nowrap px-2 py-1 text-muted">
                    {{ formatDateTime(e.timestamp) }}
                  </td>
                  <td class="px-2 py-1">
                    <UBadge :tone="levelTone(e.level)">
                      {{ e.level }}
                    </UBadge>
                  </td>
                  <td class="px-2 py-1 text-muted">
                    {{ e.service }}
                  </td>
                  <td class="max-w-[28rem] truncate px-2 py-1 text-foreground" :title="e.message">
                    {{ e.message }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <aside class="rounded-lg border border-border bg-surface p-4">
        <h3 class="mb-2 text-sm font-medium text-foreground">
          日志详情 / 翻译
        </h3>
        <template v-if="selected">
          <p class="font-mono text-[11px] text-muted">
            {{ selected.log_id }}
          </p>
          <p class="mt-1 text-sm text-foreground">
            {{ selected.message }}
          </p>
          <dl v-if="translation" class="mt-3 space-y-2 text-sm">
            <div>
              <dt class="text-xs text-muted">
                标题
              </dt><dd class="font-medium text-foreground">
                {{ translation.title }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                说明
              </dt><dd class="text-foreground">
                {{ translation.explanation }}
              </dd>
            </div>
            <div v-if="translation.module">
              <dt class="text-xs text-muted">
                模块
              </dt><dd class="text-foreground">
                {{ translation.module }}
              </dd>
            </div>
            <div v-if="translation.suggestion">
              <dt class="text-xs text-muted">
                建议
              </dt><dd class="text-foreground">
                {{ translation.suggestion }}
              </dd>
            </div>
          </dl>
          <p v-else class="mt-2 text-xs text-muted">
            暂无翻译规则匹配（raw 日志保持可见）。
          </p>
        </template>
        <p v-else class="text-sm text-muted">
          点击一条日志查看详情。
        </p>
      </aside>
    </div>
  </div>
</template>
