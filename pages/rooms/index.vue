<script setup lang="ts">
import type { RoomBatchActionId } from '~/config/action-ids'
import type { AdminRoom, RoomActionResult } from '~/types/admin'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { navigateTo } from 'nuxt/app'
import { computed, ref, watch } from 'vue'
import { createRoom, fetchRooms, runRoomBatchAction } from '~/api/admin'
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
import { ROOM_ACTION } from '~/config/action-ids'
import { roomStateLabel } from '~/features/rooms/labels'

definePageMeta({ permissions: ['room:view'] })

const { t } = usePanelI18n()

const search = ref('')
const state = ref('')
const sort = ref('updated')
const page = ref(1)
const pageNum = 100
const busy = ref(false)

const list = useAsync(() => fetchRooms({
  search: search.value || undefined,
  state: state.value || undefined,
  sort: sort.value,
  page: page.value,
  pageNum,
}))

watch([search, state, sort], () => {
  page.value = 1
  void list.run()
})
watch(page, () => void list.run())

const rooms = computed<AdminRoom[]>(() => list.data.value?.items ?? [])

// --- metric strip + row locate/highlight ---
const highlightUuid = ref('')
let highlightTimer: ReturnType<typeof setTimeout> | null = null
const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer(computed(() => ({
  count: rooms.value.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 52,
  overscan: 8,
})))

function highlightRow(uuid: string) {
  const idx = rooms.value.findIndex(r => r.room_uuid === uuid)
  if (idx >= 0)
    virtualizer.value.scrollToIndex(idx, { align: 'center' })
  highlightUuid.value = uuid
  if (highlightTimer)
    clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    highlightUuid.value = ''
  }, 3000)
}

const summaryMetrics = computed(() => {
  const total = rooms.value.length
  const playing = rooms.value.filter(r => r.state === 'playing').length
  const locked = rooms.value.filter(r => r.locked).length
  const hidden = rooms.value.filter(r => r.hidden).length
  return [
    {
      key: 'total',
      label: t('rooms.total'),
      value: total,
      onPick: () => {
        state.value = ''
      },
    },
    {
      key: 'playing',
      label: t('rooms.playing'),
      value: playing,
      onPick: () => {
        state.value = 'playing'
        highlightRow(rooms.value.find(r => r.state === 'playing')?.room_uuid ?? '')
      },
    },
    {
      key: 'locked',
      label: t('rooms.locked'),
      value: locked,
      onPick: () => {
        state.value = ''
        highlightRow(rooms.value.find(r => r.locked)?.room_uuid ?? '')
      },
    },
    {
      key: 'hidden',
      label: t('rooms.hidden'),
      value: hidden,
      onPick: () => {
        state.value = ''
        highlightRow(rooms.value.find(r => r.hidden)?.room_uuid ?? '')
      },
    },
  ]
})

// --- batch (§18.3: kick / force_move / ban with preview + partial failure) ---
const selected = ref(new Set<string>())
const batchAction = ref<RoomBatchActionId>(ROOM_ACTION.kick)
const batchReason = ref('')
const batchPhiraId = ref('')
const showBatch = ref(false)
const batchPreview = ref<RoomActionResult[] | null>(null)
const batchExecuting = ref(false)
const notice = useNotice()

function toggleSelect(uuid: string) {
  const s = new Set(selected.value)
  if (s.has(uuid))
    s.delete(uuid)
  else s.add(uuid)
  selected.value = s
}

const selectedList = computed(() => [...selected.value])

async function runBatch(preview: boolean) {
  batchExecuting.value = true
  try {
    const phiraId = Number(batchPhiraId.value)
    if (!Number.isInteger(phiraId) || phiraId <= 0) {
      notice.error('errors.api.ROOM_BATCH_TARGET_REQUIRED', { dedupKey: 'rooms:batch:target' })
      return
    }
    const res = await runRoomBatchAction(batchAction.value, selectedList.value, { reason: batchReason.value || undefined, phira_id: phiraId }, preview)
    batchPreview.value = res.items
    if (!preview) {
      res.failed > 0 ? notice.warning('notice.actionFailed', { params: { count: res.failed }, dedupKey: 'rooms:batch:partial' }) : notice.success('notice.actionCompleted', { dedupKey: 'rooms:batch' })
      selected.value = new Set()
    }
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'rooms:batch:error' })
  }
  finally {
    batchExecuting.value = false
  }
}

function batchErrorText(item: RoomActionResult): string {
  const code = item.error?.code
  return code ? t(`errors.api.${code}`) : t('rooms.failed')
}

const stateTone = (s: string) => (s === 'playing' ? 'live' : s === 'select_chart' || s === 'waiting_for_ready' ? 'warning' : 'neutral')

// --- create room (§18.3 Actions create) ---
const createOpen = ref(false)
const createName = ref('')

async function doCreate() {
  if (!createName.value.trim())
    return
  busy.value = true
  try {
    const room = await createRoom({ name: createName.value.trim() })
    notice.success('notice.created', { dedupKey: 'room:create' })
    createOpen.value = false
    createName.value = ''
    void list.run()
    await navigateTo(`/rooms/${room.room_uuid}`)
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'room:create:error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('rooms.title')" :subtitle="t('rooms.subtitle')">
      <template #actions>
        <PPButton weight="primary" size="sm" @click="createOpen = true">
          {{ t('rooms.create') }}
        </PPButton>
        <PPButton weight="secondary" size="sm" :disabled="selectedList.length === 0" @click="showBatch = true">
          {{ t('rooms.batch', { count: selectedList.length }) }}
        </PPButton>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap border-y border-border" :aria-label="t('rooms.metricsLabel')">
      <button
        v-for="c in summaryMetrics"
        :key="c.key"
        type="button"
        class="min-h-14 min-w-32 flex-1 border-r border-border px-3 py-2 text-left last:border-r-0 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        @click="c.onPick()"
      >
        <span class="block text-[11px] uppercase tracking-[0.1em] text-muted">{{ c.label }}</span>
        <span class="mt-0.5 block text-lg font-semibold tabular-nums text-foreground">{{ c.value }}</span>
      </button>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <PPInput v-model="search" :placeholder="t('rooms.search')" class="w-64" />
      <PPSelect
        v-model="state"
        :placeholder="t('users.status')"
        :options="[
          { label: t('rooms.playing'), value: 'playing' },
          { label: t('rooms.selectChart'), value: 'select_chart' },
          { label: t('rooms.waitingReady'), value: 'waiting_for_ready' },
          { label: t('rooms.idle'), value: 'idle' },
        ]"
      />
      <PPSelect
        v-model="sort"
        :placeholder="t('rooms.sort')"
        :options="[
          { label: t('rooms.updated'), value: 'updated' },
          { label: t('rooms.created'), value: 'created' },
          { label: t('rooms.members'), value: 'members' },
        ]"
      />
    </div>

    <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="rooms.length === 0">
      <div ref="parentRef" class="h-[60vh] overflow-auto rounded-lg border border-border bg-surface">
        <div class="relative" :style="{ height: `${virtualizer.getTotalSize()}px` }">
          <div
            v-for="v in virtualizer.getVirtualItems()"
            :key="String(v.key)"
            class="absolute left-0 right-0 top-0"
            :style="{ transform: `translateY(${v.start}px)` }"
          >
            <div
              class="flex items-center gap-3 border-b border-border px-3 py-1.5 text-sm transition-colors"
              :class="[highlightUuid === rooms[v.index]?.room_uuid ? 'bg-accent-soft' : 'hover:bg-surface-secondary']"
            >
              <input
                type="checkbox"
                class="rounded"
                :checked="selected.has(rooms[v.index]?.room_uuid ?? '')"
                @change="toggleSelect(rooms[v.index]?.room_uuid ?? '')"
              >
              <NuxtLink :to="`/rooms/${rooms[v.index]?.room_uuid}`" class="min-w-0 flex-1 truncate font-medium text-accent hover:underline">
                {{ rooms[v.index]?.name }}
              </NuxtLink>
              <PPStatus :tone="stateTone(rooms[v.index]?.state ?? '')">
                {{ roomStateLabel(t, rooms[v.index]?.state) }}
              </PPStatus>
              <span class="w-16 text-right text-muted">{{ t('rooms.people', { count: rooms[v.index]?.members ?? 0 }) }}</span>
              <span v-if="rooms[v.index]?.host_id != null" class="w-20 text-xs text-muted">#{{ rooms[v.index]?.host_id }}</span>
              <span v-if="rooms[v.index]?.locked" class="text-xs text-warning">{{ t('rooms.lockedShort') }}</span>
              <span v-if="rooms[v.index]?.hidden" class="text-xs text-muted">{{ t('rooms.hiddenShort') }}</span>
            </div>
          </div>
        </div>
      </div>
    </AsyncState>

    <PPPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />

    <!-- Batch modal -->
    <PPModal :open="showBatch" :title="t('rooms.batchTitle')" width="max-w-2xl" @close="showBatch = false">
      <div class="space-y-4">
        <p class="text-sm text-muted">
          {{ t('rooms.batchSelected', { count: selectedList.length }) }}
        </p>
        <PPSelect
          v-model="batchAction"
          :label="t('rooms.action')"
          :options="[
            { label: `${t('rooms.kick')} (room.kick)`, value: ROOM_ACTION.kick },
            { label: `${t('rooms.forceMove')} (room.force_move)`, value: ROOM_ACTION.forceMove },
            { label: `${t('rooms.ban')} (room.ban)`, value: ROOM_ACTION.ban },
          ]"
        />
        <PPInput v-model="batchPhiraId" :label="t('rooms.batchTarget')" placeholder="123456" inputmode="numeric" />
        <PPInput v-model="batchReason" :label="t('rooms.batchReason')" :placeholder="t('rooms.maintenanceReason')" />

        <div v-if="batchPreview">
          <h4 class="mb-1 text-sm font-medium text-foreground">
            {{ t('rooms.previewImpact') }}
          </h4>
          <ul class="max-h-40 space-y-0.5 overflow-auto text-xs text-muted">
            <li v-for="r in batchPreview" :key="r.room_uuid" :class="r.ok ? 'text-success' : 'text-danger'">
              {{ r.room_uuid }} — {{ r.ok ? 'OK' : batchErrorText(r) }}
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="showBatch = false">
            {{ t('rooms.cancel') }}
          </PPButton>
          <PPButton weight="secondary" :disabled="batchExecuting" @click="runBatch(true)">
            {{ t('rooms.previewButton') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="batchExecuting" @click="runBatch(false)">
            {{ t('rooms.execute') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Create room modal -->
    <PPModal :open="createOpen" :title="t('rooms.createTitle')" width="max-w-md" @close="createOpen = false">
      <div class="space-y-3">
        <PPInput v-model="createName" :label="t('rooms.roomName')" :placeholder="t('rooms.roomNamePlaceholder')" required />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="createOpen = false">
            {{ t('rooms.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy || !createName.trim()" @click="doCreate">
            {{ t('rooms.createButton') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
