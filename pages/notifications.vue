<script setup lang="ts">
import type { NotificationAction } from '~/types/admin'
import { computed, ref } from 'vue'
import { fetchNotificationDelivery, sendAdminNotification } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import USelect from '~/components/ui/USelect.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['notification:send_system'] })

const form = ref({
  type: 'system',
  priority: 'normal',
  title: '',
  body: '',
  targetAll: true,
  groupIds: '',
  userIds: '',
})
const actionLabel = ref('')
const actionType = ref<NotificationAction>('open_room')
const actions = ref<Array<{ label: string, action: NotificationAction }>>([])

/** §22 whitelist — the ONLY notification action values allowed. */
const ACTION_OPTIONS: Array<{ label: string, value: NotificationAction }> = [
  { label: '加入房间（join_room）', value: 'join_room' },
  { label: '接受好友（friend_accept）', value: 'friend_accept' },
  { label: '拒绝好友（friend_reject）', value: 'friend_reject' },
  { label: '打开谱面（open_chart）', value: 'open_chart' },
  { label: '打开 Replay（open_replay）', value: 'open_replay' },
  { label: '打开房间（open_room）', value: 'open_room' },
  { label: '打开用户（open_user）', value: 'open_user' },
  { label: '打开主页（open_profile）', value: 'open_profile' },
]
const busy = ref(false)
const msg = ref('')

const delivery = useAsync(() => fetchNotificationDelivery({ pageNum: 50 }))

const previewOpen = ref(false)

const previewSummary = computed(() => {
  if (form.value.targetAll)
    return '全部用户'
  const groups = form.value.groupIds.split(',').map(s => s.trim()).filter(Boolean)
  const users = form.value.userIds.split(',').map(s => s.trim()).filter(Boolean)
  const parts: string[] = []
  if (groups.length)
    parts.push(`用户组 ${groups.length} 个`)
  if (users.length)
    parts.push(`用户 ${users.length} 个`)
  return parts.join('；') || '（未指定目标）'
})

function addAction() {
  if (!actionLabel.value || !actionType.value)
    return
  actions.value.push({ label: actionLabel.value, action: actionType.value })
  actionLabel.value = ''
  actionType.value = 'open_room'
}

async function send() {
  busy.value = true
  msg.value = ''
  try {
    await sendAdminNotification({
      type: form.value.type,
      priority: form.value.priority as 'low' | 'normal' | 'high',
      title: form.value.title,
      body: form.value.body,
      target: {
        all: form.value.targetAll,
        group_ids: form.value.targetAll ? undefined : form.value.groupIds.split(',').map(s => s.trim()).filter(Boolean),
        user_ids: form.value.targetAll ? undefined : form.value.userIds.split(',').map(s => s.trim()).filter(Boolean),
      },
      actions: actions.value.length ? actions.value : undefined,
    })
    msg.value = '通知已发送'
    void delivery.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '发送失败'
  }
  finally {
    busy.value = false
  }
}

const statusTone = (s: string) => (s === 'delivered' ? 'success' : s === 'failed' ? 'danger' : 'warning')
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="系统通知" subtitle="Composer · target（all/group/user）· action buttons · delivery 状态（§18.13）" />

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UInput v-model="form.type" label="类型" placeholder="system / room.invite …" />
        <USelect
          v-model="form.priority"
          label="优先级"
          :options="[
            { label: '低', value: 'low' },
            { label: '普通', value: 'normal' },
            { label: '高', value: 'high' },
          ]"
        />
        <UInput v-model="form.title" label="标题" class="sm:col-span-2" />
        <UTextarea v-model="form.body" label="内容" :rows="3" class="sm:col-span-2" />
      </div>

      <label class="mt-3 flex items-center gap-2 text-sm text-foreground">
        <input v-model="form.targetAll" type="checkbox" class="rounded">
        发送给全部用户
      </label>
      <div v-if="!form.targetAll" class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UInput v-model="form.groupIds" label="目标用户组（逗号分隔）" />
        <UInput v-model="form.userIds" label="目标用户（逗号分隔）" />
      </div>

      <div class="mt-3">
        <p class="mb-1 text-sm font-medium text-foreground">
          Action 按钮
        </p>
        <div class="flex gap-2">
          <UInput v-model="actionLabel" placeholder="按钮文字" />
          <USelect v-model="actionType" :options="ACTION_OPTIONS" />
          <UButton size="sm" variant="outline" @click="addAction">
            添加
          </UButton>
        </div>
        <p class="mt-1 text-xs text-muted">
          action 仅限 §22 白名单（不塞任意 Action Registry ID）。
        </p>
        <div class="mt-2 flex flex-wrap gap-1">
          <UBadge v-for="(a, i) in actions" :key="i" tone="accent">
            {{ a.label }} → {{ a.action }}
            <button type="button" class="ml-1 text-accent-foreground" @click="actions.splice(i, 1)">
              ×
            </button>
          </UBadge>
        </div>
      </div>

      <p v-if="msg" class="mt-3 text-sm text-accent" role="status">
        {{ msg }}
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <UButton variant="outline" :disabled="!form.title || !form.body" @click="previewOpen = true">
          预览
        </UButton>
        <UButton variant="primary" :disabled="busy || !form.title || !form.body" @click="send">
          发送通知
        </UButton>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          投递状态
        </h3>
        <UButton size="sm" variant="outline" @click="delivery.run()">
          刷新
        </UButton>
      </div>
      <AsyncState :loading="delivery.loading.value" :error="delivery.error.value" :empty="(delivery.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                类型
              </th><th class="px-2 py-1">
                标题
              </th><th class="px-2 py-1">
                目标
              </th><th class="px-2 py-1">
                状态
              </th><th class="px-2 py-1">
                发送时间
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in delivery.data.value?.items ?? []" :key="d.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5 text-muted">
                {{ d.type }}
              </td>
              <td class="px-2 py-1.5">
                {{ d.title }}
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ d.target_summary }}
              </td>
              <td class="px-2 py-1.5">
                <UBadge :tone="statusTone(d.status)">
                  {{ d.status }}
                </UBadge>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(d.sent_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </section>

    <!-- Preview modal -->
    <UModal :open="previewOpen" title="通知预览" width="max-w-lg" @close="previewOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          目标：<span class="font-medium text-foreground">{{ previewSummary }}</span>
        </p>
        <div class="rounded-lg border border-border p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">{{ form.title }}</span>
            <UBadge tone="info">
              {{ form.priority }}
            </UBadge>
          </div>
          <p class="mt-2 text-sm text-foreground">
            {{ form.body }}
          </p>
          <div v-if="actions.length" class="mt-2 flex flex-wrap gap-1">
            <UBadge v-for="(a, i) in actions" :key="i" tone="accent">
              {{ a.label }}
            </UBadge>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="previewOpen = false">
            关闭
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
