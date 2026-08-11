<script setup lang="ts">
import type { Runbook } from '~/types/admin'
import { ref } from 'vue'
import { createRunbook, deleteRunbook, fetchRunbookRuns, fetchRunbooks, runRunbook, updateRunbook } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['automation:view'] })

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

async function doRun() {
  if (!running.value)
    return
  busy.value = true
  msg.value = ''
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(runArgs.value || '{}') as Record<string, unknown>
    await runRunbook(running.value.id, args)
    msg.value = 'Runbook 已触发（每个 step 对当前 principal 重新鉴权 + snapshot/audit）'
    running.value = null
    void runs.run()
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

const runStatusTone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' ? 'danger' : 'warning')
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="自动化 / Runbook" subtitle="顺序 Command + WAIT · 手动执行 · 每 step 重鉴权 + snapshot/audit（§10）">
      <template #actions>
        <UButton size="sm" variant="primary" @click="openCreate">
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
              <UButton size="sm" variant="outline" @click="running = r">
                运行
              </UButton>
              <UButton size="sm" variant="outline" @click="openEdit(r)">
                编辑
              </UButton>
              <UButton size="sm" variant="danger" @click="deleteTarget = r">
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
      <AsyncState :loading="runs.loading.value" :error="runs.error.value" :empty="(runs.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                Runbook
              </th><th class="px-2 py-1">
                状态
              </th><th class="px-2 py-1">
                开始
              </th><th class="px-2 py-1">
                完成
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in runs.data.value?.items ?? []" :key="r.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5">
                {{ r.runbook_name ?? r.runbook_id }}
              </td>
              <td class="px-2 py-1.5">
                <UBadge :tone="runStatusTone(r.status)">
                  {{ r.status }}
                </UBadge>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(r.started_at) }}
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(r.finished_at) }}
              </td>
            </tr>
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
