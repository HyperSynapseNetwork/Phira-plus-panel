<script setup lang="ts">
import type { CouponActionType } from '~/types/admin'
import { computed, ref } from 'vue'
import { completeAdminTask, createCoupon, fetchAdminTasks, fetchCoupons, revokeCoupon } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import USelect from '~/components/ui/USelect.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['coupon:view'] })

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
const msg = ref('')

const argsJson = computed({
  get: () => form.value.args,
  set: v => form.value.args = v,
})

async function doCreate() {
  busy.value = true
  msg.value = ''
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(form.value.args || '{}') as Record<string, unknown>
  }
  catch {
    msg.value = 'args 不是合法 JSON'
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
    msg.value = '优惠券已创建（兑换执行 Action，非仅标记 used）'
    createOpen.value = false
    void coupons.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '创建失败'
  }
  finally {
    busy.value = false
  }
}

async function doRevoke(id: string) {
  try {
    await revokeCoupon(id)
    void coupons.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '撤销失败'
  }
}

async function doComplete(id: string) {
  try {
    await completeAdminTask(id)
    void tasks.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '操作失败'
  }
}

const statusTone = (s: string) => (s === 'active' || s === 'completed' ? 'success' : s === 'revoked' ? 'warning' : 'danger')
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="优惠券 / 管理任务" subtitle="兑换必须执行 Action（§18.14）">
      <template #actions>
        <UButton size="sm" variant="primary" @click="createOpen = true">
          创建优惠券
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="text-sm text-accent" role="status">
      {{ msg }}
    </p>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          优惠券
        </h3>
        <UButton size="sm" variant="outline" @click="coupons.run()">
          刷新
        </UButton>
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
                模式
              </th><th class="px-2 py-1">
                状态
              </th><th class="px-2 py-1">
                创建
              </th><th class="px-2 py-1">
                操作
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
                <UBadge :tone="statusTone(c.status)">
                  {{ c.status }}
                </UBadge>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(c.created_at) }}
              </td>
              <td class="px-2 py-1.5">
                <UButton v-if="c.status === 'active'" size="sm" variant="danger" @click="doRevoke(c.id)">
                  撤销
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          Admin Tasks（待处理 / 完成）
        </h3>
        <UButton size="sm" variant="outline" @click="tasks.run()">
          刷新
        </UButton>
      </div>
      <AsyncState :loading="tasks.loading.value" :error="tasks.error.value" :empty="(tasks.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                来源
              </th><th class="px-2 py-1">
                类型
              </th><th class="px-2 py-1">
                状态
              </th><th class="px-2 py-1">
                创建
              </th><th class="px-2 py-1">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tasks.data.value?.items ?? []" :key="t.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5">
                {{ t.source }}
              </td>
              <td class="px-2 py-1.5">
                {{ t.type }}
              </td>
              <td class="px-2 py-1.5">
                <UBadge :tone="statusTone(t.status)">
                  {{ t.status }}
                </UBadge>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(t.created_at) }}
              </td>
              <td class="px-2 py-1.5">
                <UButton v-if="t.status === 'pending'" size="sm" variant="primary" @click="doComplete(t.id)">
                  完成
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </section>

    <!-- Create modal -->
    <UModal :open="createOpen" title="创建优惠券" width="max-w-lg" @close="createOpen = false">
      <div class="space-y-3">
        <UInput v-model="form.code" label="Code（留空自动生成）" />
        <USelect
          v-model="form.actionType"
          label="兑换 Action 类型"
          :options="[
            { label: '解锁账户', value: 'account_unlock' },
            { label: '账户角色', value: 'account_role' },
            { label: '管理告警', value: 'admin_alert' },
            { label: '自定义 Hook', value: 'custom_hook' },
          ]"
        />
        <USelect
          v-model="form.holderMode"
          label="持有模式"
          :options="[
            { label: 'Creator', value: 'creator' },
            { label: 'Manual', value: 'manual' },
          ]"
        />
        <UTextarea v-model="argsJson" label="Action Args (JSON)" :rows="3" mono placeholder="{ &quot;group_id&quot;: &quot;...&quot; }" />
        <UInput v-model="form.note" label="备注" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="createOpen = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy" @click="doCreate">
            创建
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
