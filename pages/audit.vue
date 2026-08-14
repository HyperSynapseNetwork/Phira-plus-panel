<script setup lang="ts">
import type { AuditEvent } from '~/types/admin'
import { ref, watch } from 'vue'
import { exportAuditCsv, fetchAudit } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPPagination from '~/components/ui/PPPagination.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import { useAsync } from '~/composables/useAsync'
import { auditResultLabel } from '~/features/audit/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['audit:view'] })

const { t } = usePanelI18n()

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
const notice = useNotice()

async function doExport() {
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
    notice.success('notice.actionCompleted', { dedupKey: 'audit:export' })
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'audit:export:error' })
  }
}

const resultTone = (r: string) => (r === 'success' ? 'success' : r === 'denied' ? 'warning' : 'error')
</script>

<template>
  <div>
    <PageHeader :title="t('auditPage.title')" :subtitle="t('auditPage.subtitle')">
      <template #actions>
        <PPButton size="sm" weight="secondary" :disabled="list.loading.value" @click="doExport">
          {{ t('auditPage.export') }}
        </PPButton>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <PPInput v-model="search" :placeholder="t('auditPage.search')" class="w-64" />
      <PPSelect
        v-model="principalType"
        :placeholder="t('auditPage.principalType')"
        :options="[
          { label: 'Root', value: 'root' },
          { label: 'User', value: 'user' },
        ]"
      />
      <PPSelect
        v-model="result"
        :placeholder="t('auditPage.result')"
        :options="[
          { label: t('auditPage.success'), value: 'success' },
          { label: t('auditPage.failure'), value: 'failure' },
          { label: t('auditPage.denied'), value: 'denied' },
        ]"
      />
    </div>

    <div class="overflow-x-auto rounded-lg border border-border bg-surface">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border text-xs uppercase text-muted">
            <th class="px-3 py-2 font-medium">
              {{ t('auditPage.time') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('auditPage.principal') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('auditPage.action') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('auditPage.resource') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('auditPage.result') }}
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
                <PPStatus :tone="resultTone(e.result)">
                  {{ auditResultLabel(t, e.result) }}
                </PPStatus>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-muted">
                {{ e.ip ?? '—' }}
              </td>
            </tr>
          </AsyncState>
        </tbody>
      </table>
    </div>

    <PPPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />

    <!-- Detail modal -->
    <PPModal :open="!!detail" :title="t('auditPage.detail')" width="max-w-2xl" @close="detail = null">
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
            {{ t('auditPage.time') }}
          </dt><dd class="text-foreground">
            {{ formatDateTime(detail.occurred_at) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.action') }}
          </dt><dd class="font-mono text-foreground">
            {{ detail.action }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.resource') }}
          </dt><dd class="text-foreground">
            {{ detail.resource_type }} / {{ detail.resource_id ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.result') }}
          </dt><dd class="text-foreground">
            {{ auditResultLabel(t, detail.result) }}<span v-if="detail.error_code" class="ml-2 font-mono text-xs text-danger">{{ detail.error_code }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.requestCommand') }}
          </dt><dd class="font-mono text-xs text-foreground">
            {{ detail.request_id ?? '—' }} / {{ detail.command_id ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.ipUa') }}
          </dt><dd class="font-mono text-xs text-foreground">
            {{ detail.ip ?? '—' }} · {{ detail.user_agent ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            {{ t('auditPage.parameters') }}
          </dt>
          <dd><pre class="mt-1 max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ JSON.stringify(detail.parameters_redacted, null, 2) }}</pre></dd>
        </div>
      </dl>
    </PPModal>
  </div>
</template>
