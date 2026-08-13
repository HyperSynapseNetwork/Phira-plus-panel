<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  cancelJob,
  createJob,
  fetchJobs,
  fetchServerGates,
  fetchServerRuntime,
  fetchServerStats,
  fetchServerStatus,
  retryJob,
  runServerAction,
} from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import KpiCard from '~/components/admin/KpiCard.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UCard from '~/components/ui/UCard.vue'
import UModal from '~/components/ui/UModal.vue'
import USwitch from '~/components/ui/USwitch.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { SERVER_ACTION, UPDATE_JOB } from '~/config/action-ids'
import { useAuthStore } from '~/stores/auth'
import { ApiError } from '~/utils/api-error'
import { formatDuration, formatNumber } from '~/utils/format'
import type { Job } from '~/types/admin'

definePageMeta({ permissions: ['server:view'] })

const reauth = useReauth()
const auth = useAuthStore()
const canRetry = computed(() => auth.hasPermission(['server:update']))

// §23 #6: compose four typed endpoints instead of one giant status.
const status = useAsync(() => fetchServerStatus())
const stats = useAsync(() => fetchServerStats())
const runtime = useAsync(() => fetchServerRuntime())
const gates = useAsync(() => fetchServerGates())
const jobs = useAsync(() => fetchJobs({ pageNum: 100 }))

const busy = ref(false)
const msg = ref('')
const confirmShutdown = ref(false)

// ---------------------------------------------------------------------------
// PMP update via Job API (P0-1, design §9.4 / §23 #7 honest stage)
// ---------------------------------------------------------------------------
const UPDATE_TYPES = new Set<string>([UPDATE_JOB.check, UPDATE_JOB.apply])

/** Most recent update job (jobs list is `created_at DESC`). */
const updateJob = computed<Job | undefined>(() =>
  (jobs.data.value?.items ?? []).find(j => UPDATE_TYPES.has(j.type)),
)
const updateActive = computed(() =>
  updateJob.value != null && (updateJob.value.state === 'queued' || updateJob.value.state === 'running'),
)
const updateTone = computed<'neutral' | 'success' | 'warning' | 'danger'>(() => {
  const s = updateJob.value?.state
  return s === 'succeeded' ? 'success' : s === 'failed' ? 'danger' : s === 'cancelled' ? 'neutral' : 'warning'
})
const updateLabel = computed(() => {
  const j = updateJob.value
  if (!j)
    return '空闲'
  switch (j.state) {
    case 'queued':
      return '排队中…'
    case 'running':
      return j.stage === 'executing_pmp_update'
        ? '应用更新中…'
        : j.stage === 'checking' ? '检查更新中…' : (j.stage || '运行中…')
    case 'succeeded':
      return j.stage === 'checked' ? '已是最新版本' : '更新完成'
    case 'failed':
      return j.stage === 'timeout' ? '更新超时' : '更新失败'
    case 'cancelled':
      return '已取消'
    default:
      return j.state
  }
})
const updateProgress = computed(() => {
  const p = updateJob.value?.progress
  return p == null ? null : Math.round(p * 100)
})

/** Silent poll — does not flip `jobs.loading`, so the card doesn't flicker. */
async function pollJobs() {
  try {
    jobs.data.value = await fetchJobs({ pageNum: 100 })
  }
  catch {
    // transient — next tick retries
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
function startPolling() {
  if (pollTimer)
    return
  pollTimer = setInterval(() => void pollJobs(), 2500)
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
watch(updateActive, (active) => {
  if (active)
    startPolling()
  else
    stopPolling()
}, { immediate: true })
onBeforeUnmount(stopPolling)

async function createUpdateJob(type: string, reauthToken?: string) {
  msg.value = ''
  busy.value = true
  try {
    await createJob(type, {}, reauthToken)
    msg.value = `已提交 ${type} 任务`
    await jobs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '提交失败'
  }
  finally {
    busy.value = false
  }
}

function dispatchUpdateApply() {
  // §23 #10: pmp.update.apply requires critical reauth (server-side enforced too).
  reauth.requireReauth(async (token) => {
    await createUpdateJob(UPDATE_JOB.apply, token)
  })
}

async function doCancelUpdate() {
  const j = updateJob.value
  if (!j)
    return
  msg.value = ''
  busy.value = true
  try {
    await cancelJob(j.id)
    msg.value = '已请求取消'
    await jobs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '取消失败'
  }
  finally {
    busy.value = false
  }
}

async function doRetryUpdate() {
  const j = updateJob.value
  if (!j)
    return
  msg.value = ''
  busy.value = true
  try {
    await retryJob(j.id)
    msg.value = '已重新入队'
    await jobs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '重试失败'
  }
  finally {
    busy.value = false
  }
}

// ---------------------------------------------------------------------------
// Server actions (gates / config reload / shutdown)
// ---------------------------------------------------------------------------
async function act(action: Parameters<typeof runServerAction>[0], args: Record<string, unknown> = {}, reauthToken?: string) {
  msg.value = ''
  busy.value = true
  try {
    await runServerAction(action, args, reauthToken)
    msg.value = `操作 ${action} 已提交`
    if (action === SERVER_ACTION.setConnections || action === SERVER_ACTION.setRoomCreation)
      void gates.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '操作失败'
  }
  finally {
    busy.value = false
  }
}

// §23 #10: only shutdown needs reauth among the remaining server actions.
const REAUTH_SERVER_ACTIONS = new Set<string>([SERVER_ACTION.shutdown])

function dispatchServerAction(action: Parameters<typeof runServerAction>[0], args: Record<string, unknown> = {}) {
  if (REAUTH_SERVER_ACTIONS.has(action)) {
    reauth.requireReauth(async (token) => {
      await act(action, args, token)
    })
  }
  else {
    void act(action, args)
  }
}

function doShutdown() {
  confirmShutdown.value = false
  dispatchServerAction(SERVER_ACTION.shutdown, { reason: 'admin' })
}

// Runtime payload is dynamic (P-90); render top-level entries verbatim.
const runtimeEntries = computed(() => {
  const r = runtime.data.value
  if (!r || typeof r !== 'object')
    return []
  return Object.entries(r).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }))
})
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="服务器" subtitle="PMP / PPB 状态 · 运行时诊断 · 门控 · 更新（Job API）">
      <template #actions>
        <UButton variant="danger" size="sm" @click="confirmShutdown = true">
          关闭服务器
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="text-sm text-accent" role="status">
      {{ msg }}
    </p>

    <!-- Status / stats KPI -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="PMP"
        :value="status.data.value?.pmp.connected ? '已连接' : '未连接'"
        :tone="status.data.value?.pmp.connected ? 'success' : 'danger'"
        :hint="`v${status.data.value?.pmp.version ?? '—'}`"
      />
      <KpiCard label="PPB" :value="status.data.value?.ppb_version ?? '—'" hint="后端版本" />
      <KpiCard label="在线用户" :value="formatNumber(stats.data.value?.users_online)" hint="PMP 在线" />
      <KpiCard label="活动房间" :value="formatNumber(stats.data.value?.active_rooms)" hint="PMP 房间" />
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AsyncState :loading="stats.loading.value" :error="stats.error.value" :empty="false">
        <UCard title="服务器统计" subtitle="PMP typed stats（§23 #6）">
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-xs text-muted">会话</dt>
              <dd class="text-foreground">{{ formatNumber(stats.data.value?.active_sessions) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">已加载插件</dt>
              <dd class="text-foreground">{{ formatNumber(stats.data.value?.loaded_plugins) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">运行时长</dt>
              <dd class="text-foreground">{{ formatDuration(stats.data.value?.uptime_secs) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">端口</dt>
              <dd class="text-foreground">{{ stats.data.value?.port ?? '—' }} / {{ stats.data.value?.http_port ?? '—' }}</dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs text-muted">服务器名</dt>
              <dd class="text-foreground">{{ stats.data.value?.server_name || '—' }}</dd>
            </div>
          </dl>
        </UCard>
      </AsyncState>

      <AsyncState :loading="runtime.loading.value" :error="runtime.error.value" :empty="runtimeEntries.length === 0" empty-text="runtime.status 无数据">
        <UCard title="运行时诊断" subtitle="PMP runtime.status（动态 JSON，P-90）">
          <dl v-if="runtimeEntries.length" class="grid grid-cols-2 gap-3 text-sm">
            <div v-for="e in runtimeEntries" :key="e.key">
              <dt class="text-xs text-muted">{{ e.key }}</dt>
              <dd class="break-all text-foreground">{{ e.value }}</dd>
            </div>
          </dl>
        </UCard>
      </AsyncState>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AsyncState :loading="gates.loading.value" :error="gates.error.value" :empty="false">
        <UCard title="连接与创建门控">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-foreground">连接门控</span>
              <USwitch
                :model-value="gates.data.value?.connections ?? false"
                :disabled="busy || gates.data.value?.connections == null"
                @update:model-value="v => act(SERVER_ACTION.setConnections, { enabled: v })"
              />
            </div>
            <p v-if="gates.data.value?.connections == null" class="text-xs text-muted">
              读取状态不可用（PPB 未返回门控状态）——开关仅用于下发命令。
            </p>
            <div class="flex items-center justify-between">
              <span class="text-sm text-foreground">房间创建</span>
              <USwitch
                :model-value="gates.data.value?.room_creation ?? false"
                :disabled="busy || gates.data.value?.room_creation == null"
                @update:model-value="v => act(SERVER_ACTION.setRoomCreation, { enabled: v })"
              />
            </div>
            <p v-if="gates.data.value?.room_creation == null" class="text-xs text-muted">
              房间创建门控读取端点尚未实现（PPB 待补）——开关仅用于下发命令。
            </p>
          </div>
        </UCard>
      </AsyncState>

      <AsyncState :loading="jobs.loading.value" :error="jobs.error.value" :empty="false">
        <UCard title="PMP 更新" subtitle="低带宽安全 · Job API（§9.4 / §23 #7 诚实 stage）">
          <div class="flex flex-wrap items-center gap-3">
            <UBadge :tone="updateTone">
              {{ updateLabel }}
            </UBadge>
            <span v-if="updateJob" class="text-xs text-muted">
              type={{ updateJob.type }} · stage={{ updateJob.stage || '—' }}
            </span>
            <span v-if="updateProgress != null" class="text-xs text-muted">
              {{ updateProgress }}%
            </span>
          </div>
          <p v-if="updateJob?.error" class="mt-2 text-sm text-danger">
            {{ updateJob.error }}
          </p>
          <p v-if="updateJob?.state === 'succeeded' && updateJob.stage === 'checked'" class="mt-2 text-sm text-success">
            已是最新版本，无需更新。
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" :disabled="busy || updateActive" @click="createUpdateJob(UPDATE_JOB.check)">
              检查更新
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy || updateActive" @click="dispatchUpdateApply">
              应用更新
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy || !updateActive" @click="doCancelUpdate">
              取消
            </UButton>
            <UButton
              v-if="updateJob && (updateJob.state === 'failed' || updateJob.state === 'cancelled')"
              size="sm"
              variant="outline"
              :disabled="busy || !canRetry"
              @click="doRetryUpdate"
            >
              重试
            </UButton>
          </div>
        </UCard>
      </AsyncState>
    </div>

    <UCard title="维护与启动适配器">
      <div class="flex flex-wrap gap-2">
        <UButton size="sm" variant="outline" :disabled="busy" @click="act(SERVER_ACTION.configReload)">
          重载配置
        </UButton>
      </div>
      <p class="mt-2 text-xs text-muted">
        「从 Panel 启动 PMP」仅通过受控 Process Supervisor Adapter（固定 executable/service、allowlist 启动参数）——禁止任意 shell（§18.6 / §27.6）。当前部署 adapter 未配置时，此页面明确显示不支持。
      </p>
      <p class="mt-1 text-xs text-warning">
        当前 adapter 未配置 —— 不支持从 Panel 启动。
      </p>
    </UCard>

    <UModal :open="confirmShutdown" title="确认关闭服务器" width="max-w-md" @close="confirmShutdown = false">
      <p class="text-sm text-foreground">
        确认关闭 PMP 服务器？该操作会中断所有房间与在线玩家。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="confirmShutdown = false">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="doShutdown">
            确认关闭
          </UButton>
        </div>
      </template>
    </UModal>

    <ReauthModal
      :open="reauth.open.value"
      :busy="reauth.busy.value"
      :error="reauth.error.value"
      :password="reauth.password.value"
      @update:password="v => reauth.password.value = v"
      @confirm="reauth.confirm()"
      @cancel="reauth.cancel()"
    />
  </div>
</template>
