<script setup lang="ts">
import type { AdminRoom, RoomActionResult } from '~/types/admin'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { navigateTo } from 'nuxt/app'
import { computed, ref, watch } from 'vue'
import { createRoom, fetchRooms, runRoomBatchAction } from '~/api/admin'
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

definePageMeta({ permissions: ['room:view'] })

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

// --- summary cards + highlight (§18.3: card click → row locate + highlight 3s) ---
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

const summaryCards = computed(() => {
  const total = rooms.value.length
  const playing = rooms.value.filter(r => r.state === 'playing').length
  const locked = rooms.value.filter(r => r.locked).length
  const hidden = rooms.value.filter(r => r.hidden).length
  return [
    {
      key: 'total',
      label: '房间总数',
      value: total,
      onPick: () => {
        state.value = ''
      },
    },
    {
      key: 'playing',
      label: '进行中',
      value: playing,
      onPick: () => {
        state.value = 'playing'
        highlightRow(rooms.value.find(r => r.state === 'playing')?.room_uuid ?? '')
      },
    },
    {
      key: 'locked',
      label: '已锁定',
      value: locked,
      onPick: () => {
        state.value = ''
        highlightRow(rooms.value.find(r => r.locked)?.room_uuid ?? '')
      },
    },
    {
      key: 'hidden',
      label: '隐藏',
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
const batchAction = ref<'kick' | 'force_move' | 'ban'>('kick')
const batchReason = ref('')
const showBatch = ref(false)
const batchPreview = ref<RoomActionResult[] | null>(null)
const batchExecuting = ref(false)
const batchMsg = ref('')

function toggleSelect(uuid: string) {
  const s = new Set(selected.value)
  if (s.has(uuid))
    s.delete(uuid)
  else s.add(uuid)
  selected.value = s
}

const selectedList = computed(() => [...selected.value])

async function runBatch(preview: boolean) {
  batchMsg.value = ''
  batchExecuting.value = true
  try {
    const res = await runRoomBatchAction(batchAction.value, selectedList.value, { reason: batchReason.value || undefined }, preview)
    batchPreview.value = res.results
    if (!preview) {
      const failed = res.results.filter(r => !r.ok)
      batchMsg.value = failed.length ? `完成，${failed.length} 个失败（partial failure）` : '批量操作全部成功'
      selected.value = new Set()
    }
  }
  catch (err) {
    batchMsg.value = err instanceof ApiError ? err.message : '批量操作失败'
  }
  finally {
    batchExecuting.value = false
  }
}

const stateTone = (s: string) => (s === 'playing' ? 'success' : s === 'select_chart' || s === 'waiting_for_ready' ? 'warning' : 'neutral')

// --- create room (§18.3 Actions create) ---
const createOpen = ref(false)
const createName = ref('')
const createMsg = ref('')

async function doCreate() {
  createMsg.value = ''
  if (!createName.value.trim())
    return
  busy.value = true
  try {
    const room = await createRoom({ name: createName.value.trim() })
    createOpen.value = false
    createName.value = ''
    void list.run()
    await navigateTo(`/rooms/${room.room_uuid}`)
  }
  catch (err) {
    createMsg.value = err instanceof ApiError ? err.message : '创建失败'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="房间" subtitle="过滤 / 搜索 / 排序 / 虚拟滚动 · 摘要卡片点击定位行并高亮 3 秒（§18.3）">
      <template #actions>
        <UButton variant="primary" size="sm" @click="createOpen = true">
          新建房间
        </UButton>
        <UButton variant="outline" size="sm" :disabled="selectedList.length === 0" @click="showBatch = true">
          批量操作（{{ selectedList.length }}）
        </UButton>
      </template>
    </PageHeader>

    <!-- Summary cards → locate + highlight row -->
    <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <button
        v-for="c in summaryCards"
        :key="c.key"
        type="button"
        class="rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-secondary"
        @click="c.onPick()"
      >
        <p class="text-xs text-muted">
          {{ c.label }}
        </p>
        <p class="mt-1 text-2xl font-semibold text-foreground">
          {{ c.value }}
        </p>
      </button>
    </div>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UInput v-model="search" placeholder="搜索房间名 / UUID" class="w-64" />
      <USelect
        v-model="state"
        placeholder="状态"
        :options="[
          { label: '进行中', value: 'playing' },
          { label: '选图中', value: 'select_chart' },
          { label: '准备中', value: 'waiting_for_ready' },
          { label: '空闲', value: 'idle' },
        ]"
      />
      <USelect
        v-model="sort"
        placeholder="排序"
        :options="[
          { label: '最近更新', value: 'updated' },
          { label: '创建时间', value: 'created' },
          { label: '成员数', value: 'members' },
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
              <UBadge :tone="stateTone(rooms[v.index]?.state ?? '')">
                {{ rooms[v.index]?.state }}
              </UBadge>
              <span class="w-16 text-right text-muted">{{ rooms[v.index]?.members }} 人</span>
              <span class="w-20 text-xs text-muted">{{ rooms[v.index]?.host_id ?? '—' }}</span>
              <span v-if="rooms[v.index]?.locked" class="text-xs text-warning">锁</span>
              <span v-if="rooms[v.index]?.hidden" class="text-xs text-muted">隐</span>
            </div>
          </div>
        </div>
      </div>
    </AsyncState>

    <UPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />

    <!-- Batch modal -->
    <UModal :open="showBatch" title="批量操作" width="max-w-2xl" @close="showBatch = false">
      <div class="space-y-4">
        <p class="text-sm text-muted">
          已选 {{ selectedList.length }} 个房间。仅支持安全动作：kick / force_move / ban。
        </p>
        <USelect
          v-model="batchAction"
          label="动作"
          :options="[
            { label: '踢出玩家（kick）', value: 'kick' },
            { label: '转移玩家（force_move）', value: 'force_move' },
            { label: '封禁（ban）', value: 'ban' },
          ]"
        />
        <UInput v-model="batchReason" label="原因（可选）" placeholder="如：维护中" />
        <p v-if="batchMsg" class="text-sm text-accent">
          {{ batchMsg }}
        </p>

        <div v-if="batchPreview">
          <h4 class="mb-1 text-sm font-medium text-foreground">
            影响预览
          </h4>
          <ul class="max-h-40 space-y-0.5 overflow-auto text-xs text-muted">
            <li v-for="r in batchPreview" :key="r.room_uuid" :class="r.ok ? 'text-success' : 'text-danger'">
              {{ r.room_uuid }} — {{ r.ok ? 'OK' : (r.error?.message ?? 'failed') }}
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showBatch = false">
            取消
          </UButton>
          <UButton variant="outline" :disabled="batchExecuting" @click="runBatch(true)">
            预览影响
          </UButton>
          <UButton variant="danger" :disabled="batchExecuting" @click="runBatch(false)">
            执行
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Create room modal -->
    <UModal :open="createOpen" title="新建房间" width="max-w-md" @close="createOpen = false">
      <div class="space-y-3">
        <UInput v-model="createName" label="房间名称" placeholder="如：维护服" required />
        <p v-if="createMsg" class="text-sm text-danger">
          {{ createMsg }}
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="createOpen = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy || !createName.trim()" @click="doCreate">
            创建
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
