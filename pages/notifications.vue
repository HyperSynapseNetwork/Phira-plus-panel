<script setup lang="ts">
import type { NotificationAction } from '~/types/admin'
import { computed, ref } from 'vue'
import { fetchNotificationDelivery, sendAdminNotification } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPSurface from '~/components/ui/PPSurface.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['notification:send_system'] })

const { t } = usePanelI18n()
const notice = useNotice()
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
const actionTarget = ref('')
const actionFieldError = ref('')
type ActionDraft = NonNullable<Parameters<typeof sendAdminNotification>[0]['actions']>[number]
const actions = ref<ActionDraft[]>([])
const busy = ref(false)
const delivery = useAsync(() => fetchNotificationDelivery())
const previewOpen = ref(false)

const ACTION_OPTIONS = computed(() => [
  { label: t('notificationAdmin.joinRoom'), value: 'join_room' },
  { label: t('notificationAdmin.friendAccept'), value: 'friend_accept' },
  { label: t('notificationAdmin.friendReject'), value: 'friend_reject' },
  { label: t('notificationAdmin.openChart'), value: 'open_chart' },
  { label: t('notificationAdmin.openReplay'), value: 'open_replay' },
  { label: t('notificationAdmin.openRoom'), value: 'open_room' },
  { label: t('notificationAdmin.openUser'), value: 'open_user' },
  { label: t('notificationAdmin.openProfile'), value: 'open_profile' },
])

const actionTargetLabel = computed(() => {
  if (actionType.value === 'join_room' || actionType.value === 'open_room')
    return t('notificationAdmin.roomId')
  if (actionType.value === 'friend_accept' || actionType.value === 'friend_reject')
    return t('notificationAdmin.friendRequestId')
  if (actionType.value === 'open_chart')
    return t('notificationAdmin.chartId')
  if (actionType.value === 'open_replay')
    return t('notificationAdmin.roundUuid')
  return t('notificationAdmin.phiraId')
})

const previewSummary = computed(() => {
  if (form.value.targetAll)
    return t('notificationAdmin.all')
  const groups = form.value.groupIds.split(',').map(value => value.trim()).filter(Boolean)
  const users = form.value.userIds.split(',').map(value => value.trim()).filter(Boolean)
  const parts: string[] = []
  if (groups.length)
    parts.push(t('notificationAdmin.groupsCount', { count: groups.length }))
  if (users.length)
    parts.push(t('notificationAdmin.usersCount', { count: users.length }))
  return parts.join(' · ') || t('notificationAdmin.none')
})

function actionData(): ActionDraft['data'] | null {
  const value = actionTarget.value.trim()
  if (!value)
    return null
  switch (actionType.value) {
    case 'join_room':
    case 'open_room': return { room_id: value }
    case 'friend_accept':
    case 'friend_reject': return { friend_request_id: value }
    case 'open_chart': {
      const chartId = Number(value)
      return Number.isFinite(chartId) ? { chart_id: chartId } : null
    }
    case 'open_replay': return { round_uuid: value }
    case 'open_user':
    case 'open_profile': {
      const phiraId = Number(value)
      return Number.isFinite(phiraId) ? { phira_id: phiraId } : null
    }
  }
}

function addAction(): void {
  actionFieldError.value = ''
  const data = actionData()
  if (!actionLabel.value.trim() || !data) {
    actionFieldError.value = t('notificationAdmin.targetRequired')
    return
  }
  actions.value.push({ label: actionLabel.value.trim(), action: actionType.value, data })
  actionLabel.value = ''
  actionTarget.value = ''
}

async function send(): Promise<void> {
  busy.value = true
  try {
    await sendAdminNotification({
      type: form.value.type.trim(),
      priority: form.value.priority as 'low' | 'normal' | 'high',
      title: form.value.title.trim(),
      body: form.value.body.trim(),
      target: {
        all: form.value.targetAll,
        group_ids: form.value.targetAll ? undefined : form.value.groupIds.split(',').map(value => value.trim()).filter(Boolean),
        user_ids: form.value.targetAll ? undefined : form.value.userIds.split(',').map(value => value.trim()).filter(Boolean),
      },
      actions: actions.value.length ? actions.value : undefined,
    })
    notice.success('notice.sent', { dedupKey: 'admin-notification:send' })
    void delivery.run()
  }
  catch (error) {
    notice.errorFromApi(error, { dedupKey: 'admin-notification:send:error' })
  }
  finally {
    busy.value = false
  }
}

function statusTone(status: string) {
  return status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'warning'
}
function statusLabel(status: string): string {
  if (status === 'delivered')
    return t('notificationAdmin.delivered')
  if (status === 'failed')
    return t('notificationAdmin.failed')
  if (status === 'queued')
    return t('notificationAdmin.queued')
  return status
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('notificationAdmin.title')" :subtitle="t('notificationAdmin.subtitle')" />

    <PPSurface padded>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PPInput v-model="form.type" :label="t('notificationAdmin.type')" placeholder="system / room.invite …" />
        <PPSelect
          v-model="form.priority"
          :label="t('notificationAdmin.priority')"
          :options="[
            { label: t('notificationAdmin.priorityLow'), value: 'low' },
            { label: t('notificationAdmin.priorityNormal'), value: 'normal' },
            { label: t('notificationAdmin.priorityHigh'), value: 'high' },
          ]"
        />
        <PPInput v-model="form.title" :label="t('notificationAdmin.messageTitle')" class="sm:col-span-2" />
        <PPTextarea v-model="form.body" :label="t('notificationAdmin.body')" :rows="3" class="sm:col-span-2" />
      </div>

      <label class="mt-3 flex items-center gap-2 text-sm text-foreground">
        <input v-model="form.targetAll" type="checkbox" class="rounded">
        {{ t('notificationAdmin.allUsers') }}
      </label>
      <div v-if="!form.targetAll" class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PPInput v-model="form.groupIds" :label="t('notificationAdmin.groups')" />
        <PPInput v-model="form.userIds" :label="t('notificationAdmin.users')" />
      </div>

      <div class="mt-4 border-t border-border pt-4">
        <p class="mb-2 text-sm font-medium text-foreground">
          {{ t('notificationAdmin.actions') }}
        </p>
        <div class="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)_minmax(0,1fr)_auto]">
          <PPInput v-model="actionLabel" :placeholder="t('notificationAdmin.actionLabel')" />
          <PPSelect v-model="actionType" :options="ACTION_OPTIONS" @update:model-value="actionTarget = ''; actionFieldError = ''" />
          <PPInput v-model="actionTarget" :placeholder="actionTargetLabel" />
          <PPButton size="sm" weight="secondary" @click="addAction">
            {{ t('notificationAdmin.addAction') }}
          </PPButton>
        </div>
        <p v-if="actionFieldError" class="mt-1 text-xs text-danger" role="alert">
          {{ actionFieldError }}
        </p>
        <div class="mt-2 flex flex-wrap gap-1">
          <PPBadge v-for="(action, index) in actions" :key="`${action.action}:${index}`" tone="accent">
            {{ action.label }} → {{ action.action }}
            <button type="button" data-pp-touch-critical="removable-action" class="pp-touch-target ml-1 inline-flex h-11 w-11 items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-foreground" :aria-label="t('common.remove')" @click="actions.splice(index, 1)">
              <PPIcon name="close" :size="14" />
            </button>
          </PPBadge>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <PPButton weight="secondary" :disabled="!form.title || !form.body" @click="previewOpen = true">
          {{ t('notificationAdmin.preview') }}
        </PPButton>
        <PPButton weight="primary" :disabled="busy || !form.title || !form.body" @click="send">
          {{ t('notificationAdmin.send') }}
        </PPButton>
      </div>
    </PPSurface>

    <PPSurface padded>
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ t('notificationAdmin.delivery') }}
        </h3>
        <PPButton size="sm" weight="secondary" @click="delivery.run()">
          {{ t('notificationAdmin.refresh') }}
        </PPButton>
      </div>
      <AsyncState :loading="delivery.loading.value" :error="delivery.error.value" :empty="(delivery.data.value?.items ?? []).length === 0">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-2 py-1">
                {{ t('notificationAdmin.type') }}
              </th>
              <th class="px-2 py-1">
                {{ t('notificationAdmin.messageTitle') }}
              </th>
              <th class="px-2 py-1">
                {{ t('notificationAdmin.target') }}
              </th>
              <th class="px-2 py-1">
                {{ t('notificationAdmin.status') }}
              </th>
              <th class="px-2 py-1">
                {{ t('notificationAdmin.sentAt') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in delivery.data.value?.items ?? []" :key="item.id" class="border-b border-border last:border-0">
              <td class="px-2 py-1.5 text-muted">
                {{ item.type }}
              </td>
              <td class="px-2 py-1.5">
                {{ item.title }}
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ item.target_summary }}
              </td>
              <td class="px-2 py-1.5">
                <PPStatus :tone="statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </PPStatus>
              </td>
              <td class="px-2 py-1.5 text-muted">
                {{ formatDateTime(item.sent_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </AsyncState>
    </PPSurface>

    <PPModal :open="previewOpen" :title="t('notificationAdmin.previewTitle')" width="max-w-lg" @close="previewOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ t('notificationAdmin.target') }}: <span class="font-medium text-foreground">{{ previewSummary }}</span>
        </p>
        <div class="rounded-lg border border-border p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">{{ form.title }}</span>
            <PPBadge tone="info">
              {{ form.priority }}
            </PPBadge>
          </div>
          <p class="mt-2 text-sm text-foreground">
            {{ form.body }}
          </p>
          <div v-if="actions.length" class="mt-2 flex flex-wrap gap-1">
            <PPBadge v-for="(action, index) in actions" :key="index" tone="accent">
              {{ action.label }}
            </PPBadge>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <PPButton weight="quiet" @click="previewOpen = false">
            {{ t('common.close') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
