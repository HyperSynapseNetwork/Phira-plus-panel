<script setup lang="ts">
import type { AuditEvent } from '~/types/admin'
import { ref, watch } from 'vue'
import { exportAuditCsv, fetchAudit } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UPagination from '~/components/ui/UPagination.vue'
import USelect from '~/components/ui/USelect.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['audit:view'] })

const action = ref('')
const principalType = ref('')
const result = ref('')
const search = ref('')
const page = ref(1)
const pageNum = 50

const list = useAsync(() => fetchAudit({
  action: action.value || undefined,
  principal_type: principalType.value || undefined,
  result: result.value || undefined,
  search: search.value || undefined,
  page: page.value,
  pageNum,
}))

watch([action, principalType, result, search], () => {
  page.value = 1
  void list.run()
})
watch(page, () => void list.run())

const detail = ref<AuditEvent | null>(null)
const exportMsg = ref('')

async function doExport() {
  exportMsg.value = ''
  try {
    const csv = await exportAuditCsv({
      action: action.value || undefined,
      principal_type: principalType.value || undefined,
      result: result.value || undefined,
      search: search.value || undefined,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    exportMsg.value = '已导出 CSV'
  }
  catch (err) {
    exportMsg.value = err instanceof ApiError ? err.message : '导出失败'
  }
}

const resultTone = (r: string) => (r === 'success' ? 'success' : r === 'denied' ? 'warning' : 'danger')
</script>

<template>
  <div>
    <PageHeader title="审计" subtitle="筛选 / 详情 / CSV 导出 · 90 天保留（§18.12）">
      <template #actions>
        <UButton size="sm" variant="outline" :disabled="list.loading.value" @click="doExport">
          导出 CSV
        </UButton>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UInput v-model="search" placeholder="搜索 action / resource" class="w-64" />
      <USelect
        v-model="principalType"
        placeholder="主体类型"
        :options="[
          { label: 'Root', value: 'root' },
          { label: 'User', value: 'user' },
        ]"
      />
      <USelect
        v-model="result"
        placeholder="结果"
        :options="[
          { label: '成功', value: 'success' },
          { label: '失败', value: 'failure' },
          { label: '拒绝', value: 'denied' },
        ]"
      />
    </div>

    <p v-if="exportMsg" class="mb-2 text-sm text-accent">
      {{ exportMsg }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-border bg-surface">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border text-xs uppercase text-muted">
            <th class="px-3 py-2 font-medium">
              时间
            </th>
            <th class="px-3 py-2 font-medium">
              主体
            </th>
            <th class="px-3 py-2 font-medium">
              动作
            </th>
            <th class="px-3 py-2 font-medium">
              资源
            </th>
            <th class="px-3 py-2 font-medium">
              结果
            </th>
            <th class="px-3 py-2 font-medium">
              IP
            </th>
          </tr>
        </thead>
        <tbody>
          <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value?.items ?? []).length === 0">
            <tr
              v-for="e in list.data.value?.items ?? []"
              :key="e.id"
              class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-secondary"
              @click="detail = e"
            >
              <td class="whitespace-nowrap px-3 py-2 text-muted">
                {{ formatDateTime(e.occurred_at) }}
              </td>
              <td class="px-3 py-2">
                {{ e.principal_type }}<span v-if="e.actor_user_id" class="text-muted">:{{ e.actor_user_id.slice(0, 8) }}</span>
              </td>
              <td class="px-3 py-2 font-mono text-xs">
                {{ e.action }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ e.resource_type }}<span v-if="e.resource_id" class="font-mono text-xs">:{{ e.resource_id.slice(0, 8) }}</span>
              </td>
              <td class="px-3 py-2">
                <UBadge :tone="resultTone(e.result)">
                  {{ e.result }}
                </UBadge>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-muted">
                {{ e.ip ?? '—' }}
              </td>
            </tr>
          </AsyncState>
        </tbody>
      </table>
    </div>

    <UPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />

    <!-- Detail modal -->
    <UModal :open="!!detail" title="审计详情" width="max-w-2xl" @close="detail = null">
      <dl v-if="detail" class="space-y-2 text-sm">
        <div>
          <dt class="text-xs text-muted">
            ID
          </dt><dd class="font-mono text-foreground">
            {{ detail.id }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            时间
          </dt><dd class="text-foreground">
            {{ formatDateTime(detail.occurred_at) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            动作
          </dt><dd class="font-mono text-foreground">
            {{ detail.action }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            资源
          </dt><dd class="text-foreground">
            {{ detail.resource_type }} / {{ detail.resource_id ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            结果
          </dt><dd class="text-foreground">
            {{ detail.result }}<span v-if="detail.error_code" class="ml-2 font-mono text-xs text-danger">{{ detail.error_code }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Request / Command
          </dt><dd class="font-mono text-xs text-foreground">
            {{ detail.request_id ?? '—' }} / {{ detail.command_id ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            IP / UA
          </dt><dd class="font-mono text-xs text-foreground">
            {{ detail.ip ?? '—' }} · {{ detail.user_agent ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            参数（redacted）
          </dt>
          <dd><pre class="mt-1 max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ JSON.stringify(detail.parameters_redacted, null, 2) }}</pre></dd>
        </div>
      </dl>
    </UModal>
  </div>
</template>
