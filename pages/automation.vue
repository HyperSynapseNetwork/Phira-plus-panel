<script setup lang="ts">
import type { Runbook, RunbookRun } from '~/types/admin'
import { computed, onBeforeUnmount, ref } from 'vue'
import { cancelRunbookRun, createRunbook, deleteRunbook, fetchRunbookRun, fetchRunbookRuns, fetchRunbooks, runRunbook, updateRunbook } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import PPSurface from '~/components/ui/PPSurface.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { automationStatusLabel } from '~/features/automation/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['automation:view'] })

const { t } = usePanelI18n()

const auth = useAuthStore()
const canEdit = computed(() => auth.hasPermission(['automation:edit']))
const canExecute = computed(() => auth.hasPermission(['automation:execute']))

const runbooks = useAsync(() => fetchRunbooks({ pageNum: 100 }))
const runs = useAsync(() => fetchRunbookRuns({ pageNum: 50 }))

const editing = ref<Runbook | null>(null)
const creating = ref(false)
const running = ref<Runbook | null>(null)
const form = ref<{ name: string, description: string, definition: string, args: string }>({ name: '', description: '', definition: '[]', args: '{}' })
const runArgs = ref('')
const busy = ref(false)
const notice = useNotice()
const formError = ref('')

function openCreate() {
  form.value = { name: '', description: '', definition: JSON.stringify([{ action: 'broadcast.all', with: { content: t('automationPage.defaultBroadcast') } }, { wait: 30 }]), args: '{}' }
  creating.value = true
}

function openEdit(r: Runbook) {
  editing.value = r
  form.value = {
    name: r.name,
    description: r.description ?? '',
    definition: JSON.stringify(r.definition, null, 2),
    args: JSON.stringify(r.args ?? {}, null, 2),
  }
}

function closeModal() {
  creating.value = false
  editing.value = null
}

async function save() {
  busy.value = true
  formError.value = ''
  try {
    const definition = JSON.parse(form.value.definition) as Runbook['definition']
    const args = JSON.parse(form.value.args || '{}') as Runbook['args']
    if (editing.value) {
      await updateRunbook(editing.value.id, { name: form.value.name, description: form.value.description, definition, args })
    }
    else {
      await createRunbook({ name: form.value.name, description: form.value.description, definition, args })
    }
    notice.success('notice.saved', { dedupKey: 'automation:save' })
    closeModal()
    void runbooks.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'automation:save:error' })
  }
  finally {
    busy.value = false
  }
}

const deleteTarget = ref<Runbook | null>(null)

async function confirmDelete() {
  if (!deleteTarget.value)
    return
  try {
    await deleteRunbook(deleteTarget.value.id)
    notice.success('notice.deleted', { dedupKey: `automation:${deleteTarget.value.id}:delete` })
    deleteTarget.value = null
    void runbooks.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'automation:delete:error' })
  }
}

// --- Run execution tracking (§10): live current step + per-step results. ---
const liveRun = ref<RunbookRun | null>(null)
const expandedRunId = ref<string | null>(null)
const runConnectionLost = ref(false)
const pollingRunId = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const TERMINAL_RUN = new Set(['succeeded', 'failed', 'cancelled'])

function pollRun(runId: string) {
  stopPoll()
  liveRun.value = null
  runConnectionLost.value = false
  pollingRunId.value = runId
  pollTimer = setInterval(async () => {
    try {
      const run = await fetchRunbookRun(runId)
      liveRun.value = run
      runConnectionLost.value = false
      if (TERMINAL_RUN.has(run.status)) {
        stopPoll()
        void runs.run()
      }
    }
    catch {
      stopPoll()
      runConnectionLost.value = true
      notice.warning('automationPage.connectionLostNotice', { dedupKey: `automation:${runId}:poll-lost` })
    }
  }, 3000)
}

function retryPoll(): void {
  const id = pollingRunId.value ?? liveRun.value?.id
  if (id) pollRun(id)
}

onBeforeUnmount(stopPoll)

async function doRun() {
  if (!running.value)
    return
  busy.value = true
  formError.value = ''
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(runArgs.value || '{}') as Record<string, unknown>
    const res = await runRunbook(running.value.id, args)
    notice.success('notice.actionCompleted', { dedupKey: 'automation:run' })
    running.value = null
    pollRun(res.run_id)
    void runs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'automation:run:error' })
  }
  finally {
    busy.value = false
  }
}

async function cancelRun(id: string) {
  busy.value = true
  formError.value = ''
  try {
    await cancelRunbookRun(id)
    notice.success('notice.cancelled', { dedupKey: `automation:${id}:cancel` })
    void runs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `automation:${id}:cancel:error` })
  }
  finally {
    busy.value = false
  }
}

function toggleExpand(id: string) {
  expandedRunId.value = expandedRunId.value === id ? null : id
}

const runStatusTone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' ? 'error' : s === 'cancelled' ? 'neutral' : s === 'running' ? 'live' : 'warning')
const liveStep = (r: RunbookRun | null) => r?.current_step != null ? `Step ${r.current_step}/${r.step_results?.length ?? '…'}` : '—'
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('automationPage.title')" :subtitle="t('automationPage.subtitle')">
      <template #actions>
        <PPButton size="sm" weight="primary" :disabled="!canEdit" @click="openCreate">
          {{ t('automationPage.create') }}
        </PPButton>
      </template>
    </PageHeader>
    <p class="text-xs text-muted">
      {{ t('automationPage.scopeHint') }}
    </p>

    <AsyncState :loading="runbooks.loading.value" :error="runbooks.error.value" :empty="(runbooks.data.value?.items ?? []).length === 0">
      <div class="space-y-2">
        <PPSurface v-for="r in runbooks.data.value?.items ?? []" :key="r.id" padded>
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-medium text-foreground">
                {{ r.name }}
              </h3>
              <p v-if="r.description" class="mt-1 text-xs text-muted">
                {{ r.description }}
              </p>
              <p class="mt-1 text-[11px] text-muted">
                {{ t('automationPage.stepsUpdated', { count: r.definition.length, time: formatDateTime(r.updated_at) }) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <PPButton size="sm" weight="secondary" :disabled="!canExecute" @click="running = r">
                {{ t('automationPage.run') }}
              </PPButton>
              <PPButton size="sm" weight="secondary" :disabled="!canEdit" @click="openEdit(r)">
                {{ t('automationPage.edit') }}
              </PPButton>
              <PPButton size="sm" weight="dangerous" :disabled="!canEdit" @click="deleteTarget = r">
                {{ t('automationPage.delete') }}
              </PPButton>
            </div>
          </div>
        </PPSurface>
      </div>
    </AsyncState>

    <PPSurface padded>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ t('automationPage.history') }}
        </h3>
        <PPButton size="sm" weight="secondary" @click="runs.run()">
          {{ t('automationPage.refresh') }}
        </PPButton>
      </div>
      <div v-if="liveRun" class="mb-2 flex items-center gap-3 rounded border border-accent bg-accent-soft px-3 py-2 text-sm" role="status">
        <span class="font-medium text-foreground">
          {{ t('automationPage.running', { name: liveRun.runbook_name ?? liveRun.runbook_id }) }}
        </span>
        <span class="font-mono text-xs text-accent">
          {{ liveStep(liveRun) }}
        </span>
        <span v-if="liveRun.status === 'running'" class="text-xs text-muted">{{ t('automationPage.stepRunning') }}</span>
        <PPButton size="sm" weight="secondary" @click="cancelRun(liveRun.id)">
          {{ t('automationPage.cancel') }}
        </PPButton>
      </div>
      <div v-if="runConnectionLost" class="mb-2 flex flex-wrap items-center justify-between gap-2 border-y border-warning/50 py-2 text-sm text-warning" role="status">
        <span>{{ t('automationPage.connectionLost') }}</span>
        <PPButton size="sm" weight="secondary" @click="retryPoll">{{ t('common.retry') }}</PPButton>
      </div>

      <AsyncState :loading="runs.loading.value" :error="runs.error.value" :empty="(runs.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                {{ t('automationPage.runbook') }}
              </th><th class="px-2 py-1">
                {{ t('automationPage.state') }}
              </th><th class="px-2 py-1">
                {{ t('automationPage.step') }}
              </th><th class="px-2 py-1">
                {{ t('automationPage.started') }}
              </th><th class="px-2 py-1">
                {{ t('automationPage.finished') }}
              </th><th class="px-2 py-1">
                {{ t('automationPage.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in runs.data.value?.items ?? []" :key="r.id">
              <tr class="border-b border-border last:border-0">
                <td class="px-2 py-1.5">
                  {{ r.runbook_name ?? r.runbook_id }}
                </td>
                <td class="px-2 py-1.5">
                  <PPStatus :tone="runStatusTone(r.status)">
                    {{ automationStatusLabel(t, r.status) }}
                  </PPStatus>
                </td>
                <td class="px-2 py-1.5 font-mono text-xs text-muted">
                  {{ liveStep(r) }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(r.started_at) }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(r.finished_at) }}
                </td>
                <td class="px-2 py-1.5">
                  <div class="flex gap-1">
                    <PPButton size="sm" weight="secondary" @click="toggleExpand(r.id)">
                      {{ expandedRunId === r.id ? t('automationPage.collapse') : t('automationPage.details') }}
                    </PPButton>
                    <PPButton
                      v-if="r.status === 'queued' || r.status === 'running'"
                      size="sm"
                      weight="dangerous"
                      :disabled="busy"
                      @click="cancelRun(r.id)"
                    >
                      {{ t('automationPage.cancel') }}
                    </PPButton>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedRunId === r.id" class="border-b border-border bg-surface-secondary">
                <td colspan="6" class="px-3 py-2">
                  <div class="space-y-2 text-xs">
                    <p v-if="r.error" class="text-danger">
                      {{ t('automationPage.runFailed') }}
                    </p>
                    <div v-if="r.step_results?.length">
                      <p class="mb-1 font-medium text-foreground">
                        {{ t('automationPage.stepResults') }}
                      </p>
                      <ul class="space-y-0.5">
                        <li v-for="s in r.step_results" :key="s.step" class="flex items-center gap-2 font-mono">
                          <span class="text-muted">#{{ s.step }}</span>
                          <span class="text-foreground">{{ s.action }}</span>
                          <span :class="s.ok ? 'text-success' : 'text-danger'">{{ s.ok ? t('automationPage.stepOk') : t('automationPage.stepFailed') }}</span>
                        </li>
                      </ul>
                    </div>
                    <p v-if="!r.step_results?.length" class="text-muted">
                      {{ t('automationPage.noStepResults') }}
                    </p>
                    <details v-if="r.definition_snapshot?.length">
                      <summary class="cursor-pointer text-muted">
                        {{ t('automationPage.definitionSnapshot') }}
                      </summary>
                      <pre class="mt-1 max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono">{{ JSON.stringify(r.definition_snapshot, null, 2) }}</pre>
                    </details>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </AsyncState>
    </PPSurface>

    <!-- Create / edit -->
    <PPModal :open="creating || !!editing" :title="editing ? t('automationPage.editTitle', { name: editing.name }) : t('automationPage.createTitle')" width="max-w-2xl" @close="closeModal">
      <div class="space-y-3">
        <PPInput v-model="form.name" :label="t('automationPage.name')" required />
        <PPInput v-model="form.description" :label="t('automationPage.description')" />
        <PPTextarea v-model="form.definition" :label="t('automationPage.definitionJsonSteps')" :rows="8" mono />
        <PPTextarea v-model="form.args" :label="t('common.argsSchemaJson')" :rows="3" mono placeholder="{ &quot;notice&quot;: { &quot;type&quot;: &quot;string&quot; } }" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="closeModal">
            {{ t('automationPage.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy || !form.name" @click="save">
            {{ t('common.save') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Run -->
    <PPModal :open="!!running" :title="t('automationPage.runTitle')" width="max-w-md" @close="running = null">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ t('automationPage.runHint', { name: running?.name ?? '' }) }}
        </p>
        <PPTextarea v-model="runArgs" :label="t('common.argsJson')" :rows="4" mono :placeholder="`{ &quot;notice&quot;: &quot;${t('automationPage.defaultBroadcast')}&quot; }`" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="running = null">
            {{ t('automationPage.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="doRun">
            {{ t('automationPage.run') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Delete confirm -->
    <PPModal :open="!!deleteTarget" :title="t('automationPage.deleteTitle')" width="max-w-md" @close="deleteTarget = null">
      <p class="text-sm text-foreground">
        {{ t('automationPage.deleteConfirm', { name: deleteTarget?.name ?? '' }) }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="deleteTarget = null">
            {{ t('automationPage.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="confirmDelete">
            {{ t('common.delete') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
