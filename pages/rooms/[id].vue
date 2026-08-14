<script setup lang="ts">
import type { RoomActionArgs, RoomActionName } from '~/types/admin'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchRoom, runRoomAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import { useAsync } from '~/composables/useAsync'
import { ROOM_ACTION } from '~/config/action-ids'
import { roomStateLabel } from '~/features/rooms/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['room:view'] })

const { t } = usePanelI18n()

const route = useRoute()
const uuid = computed(() => String(route.params.id))

const room = useAsync(() => fetchRoom(uuid.value))
const notice = useNotice()
const busy = ref(false)

const kickOpen = ref(false)
const kickArgs = ref<{ user_id?: string, reason?: string }>({})
const moveOpen = ref(false)
const moveArgs = ref<{ user_id?: string, target_room_uuid?: string }>({})

const setChartId = ref('')
const setChartOpen = ref(false)

const setHostOpen = ref(false)
const hostId = ref('')

const listAction = ref<RoomActionName>(ROOM_ACTION.whitelistAdd)
const listUserId = ref('')
const listOpen = ref(false)

function doSetHost() {
  void act(ROOM_ACTION.setHost, { host_id: hostId.value ? Number(hostId.value) : undefined })
  setHostOpen.value = false
}

function doListAction() {
  if (!listUserId.value)
    return
  void act(listAction.value, { user_id: Number(listUserId.value) })
  listOpen.value = false
  listUserId.value = ''
}

async function act(action: RoomActionName, args: RoomActionArgs = {}) {
  busy.value = true
  try {
    await runRoomAction(uuid.value, action, args)
    notice.success('notice.actionCompleted', { dedupKey: `room:${uuid.value}:${action}` })
    void room.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `room:${uuid.value}:${action}:error` })
  }
  finally {
    busy.value = false
  }
}

function doKick() {
  void act(ROOM_ACTION.kick, { user_id: kickArgs.value.user_id ? Number(kickArgs.value.user_id) : undefined, reason: kickArgs.value.reason })
  kickOpen.value = false
}

function doMove() {
  void act(ROOM_ACTION.forceMove, { user_id: moveArgs.value.user_id ? Number(moveArgs.value.user_id) : undefined, target_room_uuid: moveArgs.value.target_room_uuid })
  moveOpen.value = false
}

function doSetChart() {
  void act(ROOM_ACTION.setChart, { chart_id: setChartId.value ? Number(setChartId.value) : undefined })
  setChartOpen.value = false
}

const stateTone = (s: string) => (s === 'playing' ? 'live' : s === 'select_chart' || s === 'waiting_for_ready' ? 'warning' : 'neutral')
</script>

<template>
  <div>
    <PageHeader :title="room.data.value?.name ?? uuid" :subtitle="t('roomDetail.subtitle')">
      <template #actions>
        <NuxtLink to="/rooms" class="text-xs text-muted hover:text-foreground">
          ← {{ t('roomDetail.back') }}
        </NuxtLink>
      </template>
    </PageHeader>

    <AsyncState :loading="room.loading.value" :error="room.error.value" :empty="false">
      <div class="space-y-4">
        <section class="rounded-lg border border-border bg-surface p-4">
          <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted">
                UUID
              </dt><dd class="font-mono text-foreground">
                {{ room.data.value?.room_uuid }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.state') }}
              </dt><dd>
                <PPStatus :tone="stateTone(room.data.value?.state ?? '')">
                  {{ roomStateLabel(t, room.data.value?.state) }}
                </PPStatus>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.host') }}
              </dt><dd class="text-foreground">
                {{ room.data.value?.host_id ?? (room.data.value?.system_host ? 'system' : t('common.unknown')) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.members') }}
              </dt><dd class="text-foreground">
                {{ room.data.value?.members }} · {{ t('roomDetail.spectators', { count: room.data.value?.spectators ?? 0 }) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.currentChart') }}
              </dt><dd class="text-foreground">
                {{ room.data.value?.current_chart?.name ?? room.data.value?.current_chart?.song_name ?? t('common.none') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.currentRound') }}
              </dt><dd class="font-mono text-foreground">
                {{ room.data.value?.current_round_uuid ?? t('common.none') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.tags') }}
              </dt><dd class="flex flex-wrap gap-1">
                <PPBadge v-if="room.data.value?.locked" tone="warning">
                  {{ t('roomDetail.locked') }}
                </PPBadge>
                <PPBadge v-if="room.data.value?.hidden" tone="neutral">
                  {{ t('roomDetail.hidden') }}
                </PPBadge>
                <PPBadge v-if="room.data.value?.persistent" tone="accent">
                  {{ t('roomDetail.persistent') }}
                </PPBadge>
                <PPStatus v-if="room.data.value?.degraded" tone="error">
                  {{ t('roomDetail.degraded') }}
                </PPStatus>
                <PPStatus v-if="room.data.value?.live" tone="live">
                  {{ t('roomDetail.live') }}
                </PPStatus>
                <span v-if="!room.data.value?.locked && !room.data.value?.hidden && !room.data.value?.persistent && !room.data.value?.degraded" class="text-muted">{{ t('common.none') }}</span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('roomDetail.created') }}
              </dt><dd class="text-foreground">
                {{ formatDateTime(room.data.value?.created_at) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('roomDetail.actions') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.lock, { locked: true })">
              {{ t('roomDetail.lock') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.lock, { locked: false })">
              {{ t('roomDetail.unlock') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.cycle)">
              {{ t('roomDetail.cycle') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.setHidden, { content: '' })">
              {{ t('roomDetail.toggleHidden') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.setPersistent)">
              {{ t('roomDetail.togglePersistent') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.setLive)">
              {{ t('roomDetail.toggleLive') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.start)">
              {{ t('roomDetail.start') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.cancelStart)">
              {{ t('roomDetail.cancelStart') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(ROOM_ACTION.ready)">
              {{ t('roomDetail.ready') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="busy" @click="setChartOpen = true">
              {{ t('roomDetail.selectChart') }}
            </PPButton>
            <PPButton size="sm" weight="dangerous" :disabled="busy" @click="act(ROOM_ACTION.close)">
              {{ t('roomDetail.closeRoom') }}
            </PPButton>
          </div>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('roomDetail.playersHost') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <PPButton size="sm" weight="secondary" @click="kickOpen = true">
              {{ t('roomDetail.kickPlayer') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" @click="moveOpen = true">
              {{ t('roomDetail.movePlayer') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" @click="setHostOpen = true">
              {{ t('roomDetail.setHost') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" @click="listOpen = true">
              {{ t('roomDetail.lists') }}
            </PPButton>
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ t('roomDetail.actionInvariant') }}
          </p>
        </section>
      </div>
    </AsyncState>

    <!-- Kick modal -->
    <PPModal :open="kickOpen" :title="t('roomDetail.kickPlayer')" width="max-w-md" @close="kickOpen = false">
      <div class="space-y-3">
        <PPInput v-model="kickArgs.user_id" type="number" :label="t('roomDetail.userId')" placeholder="phira_id" />
        <PPInput v-model="kickArgs.reason" :label="t('roomDetail.reason')" :placeholder="t('roomDetail.reasonPlaceholder')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="kickOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" @click="doKick">
            {{ t('roomDetail.kickPlayer') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Move modal -->
    <PPModal :open="moveOpen" :title="t('roomDetail.movePlayer')" width="max-w-md" @close="moveOpen = false">
      <div class="space-y-3">
        <PPInput v-model="moveArgs.user_id" type="number" :label="t('roomDetail.userId')" placeholder="phira_id" />
        <PPInput v-model="moveArgs.target_room_uuid" :label="t('roomDetail.targetRoom')" :placeholder="t('roomDetail.targetRoomPlaceholder')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="moveOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" @click="doMove">
            {{ t('roomDetail.movePlayer') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Set chart modal -->
    <PPModal :open="setChartOpen" :title="t('roomDetail.setChart')" width="max-w-md" @close="setChartOpen = false">
      <div class="space-y-3">
        <PPInput v-model="setChartId" type="number" :label="t('roomDetail.chartId')" placeholder="chart id" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="setChartOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" @click="doSetChart">
            {{ t('roomDetail.set') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Set host modal -->
    <PPModal :open="setHostOpen" :title="t('roomDetail.setHost')" width="max-w-md" @close="setHostOpen = false">
      <div class="space-y-3">
        <PPInput v-model="hostId" type="number" :label="t('roomDetail.hostPhiraId')" :placeholder="t('roomDetail.hostPlaceholder')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="setHostOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" @click="doSetHost">
            {{ t('roomDetail.set') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Whitelist / blacklist modal -->
    <PPModal :open="listOpen" :title="t('roomDetail.lists')" width="max-w-md" @close="listOpen = false">
      <div class="space-y-3">
        <PPSelect
          v-model="listAction"
          :label="t('roomDetail.listAction')"
          :options="[
            { label: t('roomDetail.whitelistAdd'), value: ROOM_ACTION.whitelistAdd },
            { label: t('roomDetail.whitelistRemove'), value: ROOM_ACTION.whitelistRemove },
            { label: t('roomDetail.blacklistBan'), value: ROOM_ACTION.blacklistBan },
            { label: t('roomDetail.blacklistUnban'), value: ROOM_ACTION.blacklistUnban },
          ]"
        />
        <PPInput v-model="listUserId" type="number" :label="t('roomDetail.targetUser')" :placeholder="t('roomDetail.targetUserPlaceholder')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="listOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="!listUserId" @click="doListAction">
            {{ t('roomDetail.execute') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
