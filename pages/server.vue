<script setup lang="ts">
import type { Job } from '~/types/admin'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
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
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import PPSection from '~/components/patterns/PPSection.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPSwitch from '~/components/ui/PPSwitch.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { SERVER_ACTION, UPDATE_JOB } from '~/config/action-ids'
import { jobStageLabel, jobTypeLabel } from '~/features/jobs/labels'
import { useAuthStore } from '~/stores/auth'
import { formatDuration, formatNumber } from '~/utils/format'

definePageMeta({ permissions: ['server:view'] })

const reauth = useReauth()
const auth = useAuthStore()
const { t } = usePanelI18n()
const canRetry = computed(() => auth.hasPermission(['server:update']))
const canStart = computed(() => auth.hasPermission(['server:start']))
const canShutdown = computed(() => auth.hasPermission(['server:shutdown']))

// §23 #6: compose four typed endpoints instead of one giant status.
const status = useAsync(() => fetchServerStatus())
const stats = useAsync(() => fetchServerStats())
const runtime = useAsync(() => fetchServerRuntime())
const gates = useAsync(() => fetchServerGates())
const jobs = useAsync(() => fetchJobs({ pageNum: 100 }))

const busy = ref(false)
const notice = useNotice()
const confirmShutdown = ref(false)
const confirmSupervisorStop = ref(false)
const startModal = ref(false)
const startupValues = reactive<Record<string, string | number | boolean>>({})

const deployment = computed(() => status.data.value?.deployment)
const startupSpecs = computed(() => deployment.value?.startup_args ?? [])

function openStartModal() {
  for (const key of Object.keys(startupValues)) delete startupValues[key]
  for (const spec of startupSpecs.value) {
    if (spec.kind === 'boolean')
      startupValues[spec.key] = false
    else if (spec.allowed_values?.length)
      startupValues[spec.key] = spec.allowed_values[0] ?? ''
    else startupValues[spec.key] = ''
  }
  startModal.value = true
}

function buildStartupArgs(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const spec of startupSpecs.value) {
    const raw = startupValues[spec.key]
    if (spec.kind === 'boolean') { out[spec.key] = Boolean(raw); continue }
    if (raw === '' || raw == null)
      continue
    out[spec.key] = spec.kind === 'integer' ? Number(raw) : String(raw)
  }
  return out
}

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
/**
 * Cancel is only meaningful while the job is still `queued` (before dispatch to
 * PMP). Once dispatched (`running` / `executing_pmp_update`) or finished the
 * backend cancel is a no-op, so the button is hidden instead of misleading.
 */
const updateCancellable = computed(() => updateJob.value?.state === 'queued')
const updateTone = computed<'neutral' | 'success' | 'warning' | 'error' | 'live'>(() => {
  const s = updateJob.value?.state
  return s === 'succeeded' ? 'success' : s === 'failed' ? 'error' : s === 'cancelled' ? 'neutral' : s === 'running' ? 'live' : 'warning'
})
const updateLabel = computed(() => {
  const j = updateJob.value
  if (!j)
    return t('server.idle')
  switch (j.state) {
    case 'queued':
      return t('server.queued')
    case 'running':
      return j.stage === 'executing_pmp_update'
        ? t('server.applying')
        : j.stage === 'checking' ? t('server.checking') : (j.stage || t('server.running'))
    case 'succeeded':
      return j.stage === 'checked' ? t('server.upToDate') : t('server.updateDone')
    case 'failed':
      return j.stage === 'timeout' ? t('server.updateTimeout') : t('server.updateFailed')
    case 'cancelled':
      return t('server.cancelled')
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
  busy.value = true
  try {
    await createJob(type, {}, reauthToken)
    notice.success('notice.jobCreated', { dedupKey: `server:job:${type}` })
    await jobs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `server:job:${type}:error` })
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
  busy.value = true
  try {
    await cancelJob(j.id)
    notice.success('notice.cancelled', { dedupKey: `server:job:${j.id}:cancel` })
    await jobs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `server:job:${j.id}:cancel:error` })
  }
  finally {
    busy.value = false
  }
}

async function doRetryUpdate() {
  const j = updateJob.value
  if (!j)
    return
  busy.value = true
  try {
    await retryJob(j.id)
    notice.success('notice.retried', { dedupKey: `server:job:${j.id}:retry` })
    await jobs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `server:job:${j.id}:retry:error` })
  }
  finally {
    busy.value = false
  }
}

// ---------------------------------------------------------------------------
// Server actions (gates / config reload / shutdown)
// ---------------------------------------------------------------------------
async function act(action: Parameters<typeof runServerAction>[0], args: Record<string, unknown> = {}, reauthToken?: string) {
  busy.value = true
  try {
    await runServerAction(action, args, reauthToken)
    notice.success('notice.actionCompleted', { dedupKey: `server:action:${action}` })
    if (action === SERVER_ACTION.setConnections || action === SERVER_ACTION.setRoomCreation)
      void gates.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `server:action:${action}:error` })
  }
  finally {
    busy.value = false
  }
}

const CRITICAL_SERVER_ACTIONS = new Set<string>([SERVER_ACTION.shutdown, SERVER_ACTION.start, SERVER_ACTION.supervisorStop])

function dispatchServerAction(action: Parameters<typeof runServerAction>[0], args: Record<string, unknown> = {}) {
  if (CRITICAL_SERVER_ACTIONS.has(action)) {
    reauth.requireReauth(async (token) => {
      await act(action, args, token)
    }, 'critical')
  }
  else {
    void act(action, args)
  }
}

function doShutdown() {
  confirmShutdown.value = false
  dispatchServerAction(SERVER_ACTION.shutdown, { reason: 'admin' })
}
function doSupervisorStop() {
  confirmSupervisorStop.value = false
  dispatchServerAction(SERVER_ACTION.supervisorStop, { reason: 'admin_fallback' })
}
function doStart() {
  startModal.value = false
  dispatchServerAction(SERVER_ACTION.start, buildStartupArgs())
}

function createBackupJob() {
  reauth.requireReauth(async (token) => {
    busy.value = true
    try {
      await createJob('backup', {}, token)
      notice.success('notice.jobCreated', { dedupKey: 'server:backup' })
      await jobs.run()
    }
    catch (err) {
      notice.errorFromApi(err, { dedupKey: 'server:backup:error' })
    }
    finally { busy.value = false }
  }, 'high')
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
    <PageHeader :title="t('server.title')" :subtitle="t('server.subtitle')">
      <template #actions>
        <PPButton weight="dangerous" size="sm" @click="confirmShutdown = true">
          {{ t('server.shutdown') }}
        </PPButton>
      </template>
    </PageHeader>

    <!-- Compact status band: scan first, drill into diagnostics below. -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
      <span class="inline-flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" :class="status.data.value?.pmp.connected ? 'bg-success' : 'bg-danger'" />
        <strong class="font-medium text-foreground">PMP</strong>
        <span class="text-muted">{{ status.data.value?.pmp.connected ? t('server.connected') : t('server.disconnected') }}</span>
        <span v-if="status.data.value?.pmp.version" class="font-mono text-xs text-muted">v{{ status.data.value.pmp.version }}</span>
      </span>
      <span><strong class="font-medium text-foreground">PPB</strong><span v-if="status.data.value?.ppb_version" class="ml-1 text-muted">{{ status.data.value.ppb_version }}</span></span>
      <span><strong class="font-medium text-foreground">{{ formatNumber(stats.data.value?.users_online) }}</strong> <span class="ml-1 text-muted">{{ t('server.onlineUsers') }}</span></span>
      <span><strong class="font-medium text-foreground">{{ formatNumber(stats.data.value?.active_rooms) }}</strong> <span class="ml-1 text-muted">{{ t('server.activeRooms') }}</span></span>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AsyncState :loading="stats.loading.value" :error="stats.error.value" :empty="false">
        <PPSection :title="t('server.stats')" :subtitle="t('server.statsSource')">
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-xs text-muted">
                {{ t('server.sessions') }}
              </dt>
              <dd class="text-foreground">
                {{ formatNumber(stats.data.value?.active_sessions) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('server.loadedPlugins') }}
              </dt>
              <dd class="text-foreground">
                {{ formatNumber(stats.data.value?.loaded_plugins) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('server.uptime') }}
              </dt>
              <dd class="text-foreground">
                {{ formatDuration(stats.data.value?.uptime_secs) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('server.port') }}
              </dt>
              <dd class="text-foreground">
                {{ stats.data.value?.port ?? t('common.unknown') }} / {{ stats.data.value?.http_port ?? t('common.unknown') }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs text-muted">
                {{ t('server.serverName') }}
              </dt>
              <dd class="text-foreground">
                {{ stats.data.value?.server_name || t('common.unknown') }}
              </dd>
            </div>
          </dl>
        </PPSection>
      </AsyncState>

      <AsyncState :loading="runtime.loading.value" :error="runtime.error.value" :empty="runtimeEntries.length === 0" :empty-text="t('server.runtimeEmpty')">
        <PPSection :title="t('server.runtime')" :subtitle="t('server.runtimeSubtitle')">
          <dl v-if="runtimeEntries.length" class="grid grid-cols-2 gap-3 text-sm">
            <div v-for="e in runtimeEntries" :key="e.key">
              <dt class="text-xs text-muted">
                {{ e.key }}
              </dt>
              <dd class="break-all text-foreground">
                {{ e.value }}
              </dd>
            </div>
          </dl>
        </PPSection>
      </AsyncState>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AsyncState :loading="gates.loading.value" :error="gates.error.value" :empty="false">
        <PPSection :title="t('server.gates')">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-foreground">{{ t('server.connectionGate') }}</span>
              <PPSwitch
                :model-value="gates.data.value?.connections ?? false"
                :disabled="busy"
                @update:model-value="v => act(SERVER_ACTION.setConnections, { enabled: v })"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-foreground">{{ t('server.roomCreation') }}</span>
              <PPSwitch
                :model-value="gates.data.value?.room_creation ?? false"
                :disabled="busy"
                @update:model-value="v => act(SERVER_ACTION.setRoomCreation, { enabled: v })"
              />
            </div>
          </div>
        </PPSection>
      </AsyncState>

      <AsyncState :loading="jobs.loading.value" :error="jobs.error.value" :empty="false">
        <PPSection :title="t('server.update')" :subtitle="t('server.updateSubtitle')">
          <div class="flex flex-wrap items-center gap-3">
            <PPStatus :tone="updateTone">
              {{ updateLabel }}
            </PPStatus>
            <span v-if="updateJob" class="text-xs text-muted">
              {{ jobTypeLabel(t, updateJob.type) }} · {{ jobStageLabel(t, updateJob.stage) }}
            </span>
            <span v-if="updateProgress != null" class="text-xs text-muted">
              {{ updateProgress }}%
            </span>
          </div>
          <p v-if="updateJob?.error" class="mt-2 text-sm text-danger">
            {{ t('server.updateFailed') }}
          </p>
          <p v-if="updateJob?.state === 'succeeded' && updateJob.stage === 'checked'" class="mt-2 text-sm text-success">
            {{ t('server.alreadyLatest') }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <PPButton size="sm" weight="secondary" :disabled="busy || updateActive" @click="createUpdateJob(UPDATE_JOB.check)">
              {{ t('server.checkUpdate') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy || updateActive" @click="dispatchUpdateApply">
              {{ t('server.applyUpdate') }}
            </PPButton>
            <PPButton
              v-if="updateCancellable"
              size="sm"
              weight="secondary"
              :disabled="busy"
              @click="doCancelUpdate"
            >
              {{ t('common.cancel') }}
            </PPButton>
            <PPButton
              v-if="updateJob && (updateJob.state === 'failed' || updateJob.state === 'cancelled')"
              size="sm"
              weight="secondary"
              :disabled="busy || !canRetry"
              @click="doRetryUpdate"
            >
              {{ t('server.retry') }}
            </PPButton>
          </div>
        </PPSection>
      </AsyncState>
    </div>

    <PPSection :title="t('server.maintenance')" :subtitle="t('server.maintenanceSubtitle')">
      <div class="flex flex-wrap gap-2">
        <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(SERVER_ACTION.configReload)">
          {{ t('server.reloadConfig') }}
        </PPButton>
        <PPButton v-if="deployment?.supervisor_start && canStart" size="sm" weight="primary" :disabled="busy || status.data.value?.pmp.connected" @click="openStartModal">
          {{ t('server.startMultiplayer') }}
        </PPButton>
        <PPButton v-if="deployment?.supervisor_stop && canShutdown" size="sm" weight="secondary" :disabled="busy" @click="confirmSupervisorStop = true">
          {{ t('server.adapterStop') }}
        </PPButton>
        <PPButton v-if="deployment?.backup && auth.hasPermission(['server:manage'])" size="sm" weight="secondary" :disabled="busy" @click="createBackupJob">
          {{ t('server.backup') }}
        </PPButton>
      </div>
      <p class="mt-2 text-xs text-muted">
        {{ t('server.adapterHint') }}
      </p>
      <p v-if="!deployment?.supervisor_start" class="mt-1 text-xs text-warning">
        {{ t('server.adapterMissing') }}
      </p>
    </PPSection>

    <PPModal :open="startModal" :title="t('server.startTitle')" width="max-w-lg" @close="startModal = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ t('server.startHint') }}
        </p>
        <label v-for="spec in startupSpecs" :key="spec.key" class="block">
          <span class="mb-1 block text-xs font-medium text-foreground">{{ spec.key }}<span v-if="spec.required" class="text-danger"> *</span></span>
          <PPSwitch v-if="spec.kind === 'boolean'" :model-value="Boolean(startupValues[spec.key])" @update:model-value="v => startupValues[spec.key] = v" />
          <PPSelect v-else-if="spec.allowed_values?.length" v-model="startupValues[spec.key]">
            <option v-for="value in spec.allowed_values" :key="String(value)" :value="String(value)">{{ value }}</option>
          </PPSelect>
          <PPInput v-else v-model="startupValues[spec.key]" :type="spec.kind === 'integer' ? 'number' : 'text'" />
        </label>
        <p v-if="startupSpecs.length === 0" class="text-xs text-muted">
          {{ t('server.noStartupArgs') }}
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="startModal = false">
            {{ t('common.cancel') }}
          </PPButton><PPButton weight="primary" :disabled="busy" @click="doStart">
            {{ t('server.continueReauth') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <PPModal :open="confirmSupervisorStop" :title="t('server.stopTitle')" width="max-w-md" @close="confirmSupervisorStop = false">
      <p class="text-sm text-foreground">
        {{ t('server.stopHint') }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="confirmSupervisorStop = false">
            {{ t('common.cancel') }}
          </PPButton><PPButton weight="dangerous" :disabled="busy" @click="doSupervisorStop">
            {{ t('server.continueReauth') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <PPModal :open="confirmShutdown" :title="t('server.shutdownTitle')" width="max-w-md" @close="confirmShutdown = false">
      <p class="text-sm text-foreground">
        {{ t('server.shutdownHint') }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="confirmShutdown = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="doShutdown">
            {{ t('server.confirmShutdown') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

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
