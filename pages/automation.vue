<script setup lang="ts">
import type { Runbook, RunbookRun } from '~/types/admin'
import { computed, onBeforeUnmount, ref } from 'vue'
import { cancelRunbookRun, createRunbook, deleteRunbook, fetchRunbookRun, fetchRunbookRuns, fetchRunbooks, runRunbook, updateRunbook } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['automation:view'] })

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
const msg = ref('')

function openCreate() {
  form.value = { name: '', description: '', definition: '[{"action":"broadcast.all","with":{"content":"维护中"}},{"wait":30}]', args: '{}' }
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
  msg.value = ''
  try {
    const definition = JSON.parse(form.value.definition) as Runbook['definition']
    const args = JSON.parse(form.value.args || '{}') as Runbook['args']
    if (editing.value) {
      await updateRunbook(editing.value.id, { name: form.value.name, description: form.value.description, definition, args })
    }
    else {
      await createRunbook({ name: form.value.name, description: form.value.description, definition, args })
    }
    msg.value = '已保存'
    closeModal()
    void runbooks.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : (err as Error).message
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
    msg.value = `已删除 Runbook「${deleteTarget.value.name}」`
    deleteTarget.value = null
    void runbooks.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '删除失败'
  }
}

// --- Run execution tracking (§10): live current step + per-step results. ---
const liveRun = ref<RunbookRun | null>(null)
const expandedRunId = ref<string | null>(null)
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
  pollTimer = setInterval(async () => {
    try {
      const run = await fetchRunbookRun(runId)
      liveRun.value = run
      if (TERMINAL_RUN.has(run.status)) {
        stopPoll()
        void runs.run()
      }
    }
    catch {
      stopPoll()
    }
  }, 3000)
}

onBeforeUnmount(stopPoll)

async function doRun() {
  if (!running.value)
    return
  busy.value = true
  msg.value = ''
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(runArgs.value || '{}') as Record<string, unknown>
    const res = await runRunbook(running.value.id, args)
    msg.value = 'Runbook 已触发（每个 step 对当前 principal 重新鉴权 + snapshot/audit）'
    running.value = null
    pollRun(res.run_id)
    void runs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : (err as Error).message
  }
  finally {
    busy.value = false
  }
}

async function cancelRun(id: string) {
  busy.value = true
  msg.value = ''
  try {
    await cancelRunbookRun(id)
    msg.value = '已请求取消（仅对可取消 step 生效）'
    void runs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '取消失败'
  }
  finally {
    busy.value = false
  }
}

function toggleExpand(id: string) {
  expandedRunId.value = expandedRunId.value === id ? null : id
}

const runStatusTone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' || s === 'cancelled' ? 'danger' : 'warning')
const liveStep = (r: RunbookRun | null) => r?.current_step != null ? `Step ${r.current_step}/${r.step_results?.length ?? '…'}` : '—'
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="自动化 / Runbook" subtitle="顺序 Command + WAIT · 手动执行 · 每 step 重鉴权 + snapshot/audit（§10）">
      <template #actions>
        <UButton size="sm" variant="primary" :disabled="!canEdit" @click="openCreate">
          新建 Runbook
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="text-sm text-accent" role="status">
      {{ msg }}
    </p>
    <p class="text-xs text-muted">
      V1 禁止 arbitrary shell / IF / loop / 定时触发（§10.2）。
    </p>

    <AsyncState :loading="runbooks.loading.value" :error="runbooks.error.value" :empty="(runbooks.data.value?.items ?? []).length === 0">
      <div class="space-y-2">
        <section v-for="r in runbooks.data.value?.items ?? []" :key="r.id" class="rounded-lg border border-border bg-surface p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-sm font-medium text-foreground">
                {{ r.name }}
              </h3>
              <p v-if="r.description" class="mt-1 text-xs text-muted">
                {{ r.description }}
              </p>
              <p class="mt-1 text-[11px] text-muted">
                {{ r.definition.length }} steps · 更新于 {{ formatDateTime(r.updated_at) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <UButton size="sm" variant="outline" :disabled="!canExecute" @click="running = r">
                运行
              </UButton>
              <UButton size="sm" variant="outline" :disabled="!canEdit" @click="openEdit(r)">
                编辑
              </UButton>
              <UButton size="sm" variant="danger" :disabled="!canEdit" @click="deleteTarget = r">
                删除
              </UButton>
            </div>
          </div>
        </section>
      </div>
    </AsyncState>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          执行历史
        </h3>
        <UButton size="sm" variant="outline" @click="runs.run()">
          刷新
        </UButton>
      </div>
      <div v-if="liveRun" class="mb-2 flex items-center gap-3 rounded border border-accent bg-accent-soft px-3 py-2 text-sm" role="status">
        <span class="font-medium text-foreground">
          执行中：{{ liveRun.runbook_name ?? liveRun.runbook_id }}
        </span>
        <span class="font-mono text-xs text-accent">
          {{ liveStep(liveRun) }}
        </span>
        <span v-if="liveRun.status === 'running'" class="text-xs text-muted">当前 step 执行中…</span>
        <UButton size="sm" variant="outline" @click="cancelRun(liveRun.id)">
          取消
        </UButton>
      </div>

      <AsyncState :loading="runs.loading.value" :error="runs.error.value" :empty="(runs.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                Runbook
              </th><th class="px-2 py-1">
                状态
              </th><th class="px-2 py-1">
                Step
              </th><th class="px-2 py-1">
                开始
              </th><th class="px-2 py-1">
                完成
              </th><th class="px-2 py-1">
                操作
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
                  <UBadge :tone="runStatusTone(r.status)">
                    {{ r.status }}
                  </UBadge>
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
                    <UButton size="sm" variant="outline" @click="toggleExpand(r.id)">
                      {{ expandedRunId === r.id ? '收起' : '详情' }}
                    </UButton>
                    <UButton
                      v-if="r.status === 'queued' || r.status === 'running'"
                      size="sm"
                      variant="danger"
                      :disabled="busy"
                      @click="cancelRun(r.id)"
                    >
                      取消
                    </UButton>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedRunId === r.id" class="border-b border-border bg-surface-secondary">
                <td colspan="6" class="px-3 py-2">
                  <div class="space-y-2 text-xs">
                    <p v-if="r.error" class="text-danger">
                      错误：{{ r.error }}
                    </p>
                    <div v-if="r.step_results?.length">
                      <p class="mb-1 font-medium text-foreground">
                        逐 step 结果
                      </p>
                      <ul class="space-y-0.5">
                        <li v-for="s in r.step_results" :key="s.step" class="flex items-center gap-2 font-mono">
                          <span class="text-muted">#{{ s.step }}</span>
                          <span class="text-foreground">{{ s.action }}</span>
                          <span :class="s.ok ? 'text-success' : 'text-danger'">{{ s.ok ? 'OK' : (s.error ?? 'FAILED') }}</span>
                        </li>
                      </ul>
                    </div>
                    <p v-if="!r.step_results?.length" class="text-muted">
                      暂无 step 结果。
                    </p>
                    <details v-if="r.definition_snapshot?.length">
                      <summary class="cursor-pointer text-muted">
                        definition_snapshot（§10.3）
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
    </section>

    <!-- Create / edit -->
    <UModal :open="creating || !!editing" :title="editing ? `编辑 ${editing.name}` : '新建 Runbook'" width="max-w-2xl" @close="closeModal">
      <div class="space-y-3">
        <UInput v-model="form.name" label="名称" required />
        <UInput v-model="form.description" label="描述" />
        <UTextarea v-model="form.definition" label="Definition (JSON steps)" :rows="8" mono />
        <UTextarea v-model="form.args" label="Args schema (JSON)" :rows="3" mono placeholder="{ &quot;notice&quot;: { &quot;type&quot;: &quot;string&quot; } }" />
        <p v-if="msg" class="text-sm text-danger">
          {{ msg }}
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="closeModal">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy || !form.name" @click="save">
            保存
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Run -->
    <UModal :open="!!running" title="手动执行 Runbook" width="max-w-md" @close="running = null">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          执行 <b>{{ running?.name }}</b>，传入 args（JSON）。每个 step 使用当前 principal 重新鉴权。
        </p>
        <UTextarea v-model="runArgs" label="Args (JSON)" :rows="4" mono placeholder="{ &quot;notice&quot;: &quot;维护开始&quot; }" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="running = null">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="doRun">
            执行
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirm -->
    <UModal :open="!!deleteTarget" title="确认删除 Runbook" width="max-w-md" @close="deleteTarget = null">
      <p class="text-sm text-foreground">
        确认删除 Runbook「{{ deleteTarget?.name }}」？删除后不可恢复。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="deleteTarget = null">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="confirmDelete">
            删除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
