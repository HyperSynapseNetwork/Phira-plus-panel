<script setup lang="ts">
import type { CouponActionType } from '~/types/admin'
import { computed, ref } from 'vue'
import { completeAdminTask, createCoupon, fetchAdminTasks, fetchCoupons, revokeCoupon } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import PPSurface from '~/components/ui/PPSurface.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { redemptionActionTypeLabel, redemptionStatusLabel, redemptionTaskStatusLabel } from '~/features/redemption/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['coupon:view'] })

const { t } = usePanelI18n()

const auth = useAuthStore()
const canManageTasks = computed(() => auth.hasPermission(['coupon:manage']))

const coupons = useAsync(() => fetchCoupons({ pageNum: 100 }))
const tasks = useAsync(() => fetchAdminTasks({ pageNum: 100 }))

const createOpen = ref(false)
const form = ref<{ code: string, actionType: CouponActionType, holderMode: 'creator' | 'manual', args: string, note: string }>({
  code: '',
  actionType: 'account_unlock',
  holderMode: 'manual',
  args: '{}',
  note: '',
})
const busy = ref(false)
const notice = useNotice()
const fieldError = ref('')

const argsJson = computed({
  get: () => form.value.args,
  set: v => form.value.args = v,
})

async function doCreate() {
  busy.value = true
  fieldError.value = ''
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(form.value.args || '{}') as Record<string, unknown>
  }
  catch {
    fieldError.value = t('redemptionPage.invalidJson')
    busy.value = false
    return
  }
  try {
    await createCoupon({
      code: form.value.code || undefined,
      action_type: form.value.actionType,
      holder_mode: form.value.holderMode,
      args: parsed,
      note: form.value.note || undefined,
    })
    notice.success('notice.created', { dedupKey: 'redemption:create' })
    createOpen.value = false
    void coupons.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'redemption:create:error' })
  }
  finally {
    busy.value = false
  }
}

async function doRevoke(id: string) {
  try {
    await revokeCoupon(id)
    notice.success('notice.actionCompleted', { dedupKey: `redemption:${id}:revoke` })
    void coupons.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `redemption:${id}:revoke:error` })
  }
}

async function doComplete(id: string) {
  try {
    await completeAdminTask(id)
    notice.success('notice.actionCompleted', { dedupKey: `redemption-task:${id}:complete` })
    void tasks.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `redemption-task:${id}:complete:error` })
  }
}

const statusTone = (s: string) => (s === 'active' || s === 'completed' ? 'success' : s === 'revoked' ? 'warning' : 'error')
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('redemptionPage.title')" :subtitle="t('redemptionPage.subtitle')">
      <template #actions>
        <PPButton size="sm" weight="primary" @click="createOpen = true">
          {{ t('redemptionPage.create') }}
        </PPButton>
      </template>
    </PageHeader>
    <p v-if="fieldError" class="mb-2 text-sm text-danger" role="alert">{{ fieldError }}</p>

    <PPSurface padded>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ t('redemptionPage.codes') }}
        </h3>
        <PPButton size="sm" weight="secondary" @click="coupons.run()">
          {{ t('redemptionPage.refresh') }}
        </PPButton>
      </div>
      <AsyncState :loading="coupons.loading.value" :error="coupons.error.value" :empty="(coupons.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                Code
              </th><th class="px-2 py-1">
                Action
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.mode') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.state') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.created') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in coupons.data.value?.items ?? []" :key="c.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5 font-mono">
                {{ c.code }}
              </td>
              <td class="px-2 py-1.5">
                {{ c.action_type }}
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ c.holder_mode }}
              </td>
              <td class="px-2 py-1.5">
                <PPStatus :tone="statusTone(c.status)">
                  {{ redemptionStatusLabel(t, c.status) }}
                </PPStatus>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(c.created_at) }}
              </td>
              <td class="px-2 py-1.5">
                <PPButton v-if="c.status === 'active'" size="sm" weight="dangerous" @click="doRevoke(c.id)">
                  {{ t('redemptionPage.revoke') }}
                </PPButton>
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </PPSurface>

    <PPSurface padded>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ t('redemptionPage.tasks') }}
        </h3>
        <PPButton size="sm" weight="secondary" @click="tasks.run()">
          {{ t('redemptionPage.refresh') }}
        </PPButton>
      </div>
      <AsyncState :loading="tasks.loading.value" :error="tasks.error.value" :empty="(tasks.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                {{ t('redemptionPage.source') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.type') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.state') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.created') }}
              </th><th class="px-2 py-1">
                {{ t('redemptionPage.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks.data.value?.items ?? []" :key="task.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5">
                {{ task.source }}
              </td>
              <td class="px-2 py-1.5">
                {{ redemptionActionTypeLabel(t, task.type) }}
              </td>
              <td class="px-2 py-1.5">
                <PPStatus :tone="statusTone(task.status)">
                  {{ redemptionTaskStatusLabel(t, task.status) }}
                </PPStatus>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(task.created_at) }}
              </td>
              <td class="px-2 py-1.5">
                <PPButton v-if="task.status === 'pending'" size="sm" weight="primary" :disabled="!canManageTasks" @click="doComplete(task.id)">
                  {{ t('redemptionPage.complete') }}
                </PPButton>
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </PPSurface>

    <!-- Create modal -->
    <PPModal :open="createOpen" :title="t('redemptionPage.createTitle')" width="max-w-lg" @close="createOpen = false">
      <div class="space-y-3">
        <PPInput v-model="form.code" :label="t('redemptionPage.codeAuto')" />
        <PPSelect
          v-model="form.actionType"
          :label="t('redemptionPage.actionType')"
          :options="[
            { label: t('redemptionPage.accountUnlock'), value: 'account_unlock' },
            { label: t('redemptionPage.accountRole'), value: 'account_role' },
            { label: t('redemptionPage.adminAlert'), value: 'admin_alert' },
            { label: t('redemptionPage.customHook'), value: 'custom_hook' },
          ]"
        />
        <PPSelect
          v-model="form.holderMode"
          :label="t('redemptionPage.holderMode')"
          :options="[
            { label: 'Creator', value: 'creator' },
            { label: 'Manual', value: 'manual' },
          ]"
        />
        <PPTextarea v-model="argsJson" :label="t('common.actionArgsJson')" :rows="3" mono placeholder="{ &quot;group_id&quot;: &quot;...&quot; }" />
        <PPInput v-model="form.note" :label="t('redemptionPage.note')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="createOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy" @click="doCreate">
            {{ t('redemptionPage.create') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
