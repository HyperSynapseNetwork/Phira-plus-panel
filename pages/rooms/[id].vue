<script setup lang="ts">
import type { RoomActionArgs, RoomActionName } from '~/types/admin'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchRoom, runRoomAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import USelect from '~/components/ui/USelect.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['room:view'] })

const route = useRoute()
const uuid = computed(() => String(route.params.id))

const room = useAsync(() => fetchRoom(uuid.value))
const actionMsg = ref('')
const busy = ref(false)

const kickOpen = ref(false)
const kickArgs = ref<{ user_id?: string, reason?: string }>({})
const moveOpen = ref(false)
const moveArgs = ref<{ user_id?: string, target_room_uuid?: string }>({})

const setChartId = ref('')
const setChartOpen = ref(false)

const setHostOpen = ref(false)
const hostId = ref('')

const listAction = ref<'whitelist_add' | 'whitelist_remove' | 'blacklist_ban' | 'blacklist_unban'>('whitelist_add')
const listUserId = ref('')
const listOpen = ref(false)

function doSetHost() {
  void act('set_host', { host_id: hostId.value ? Number(hostId.value) : undefined })
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
  actionMsg.value = ''
  busy.value = true
  try {
    await runRoomAction(uuid.value, action, args)
    actionMsg.value = `动作 ${action} 已执行`
    void room.run()
  }
  catch (err) {
    actionMsg.value = err instanceof ApiError ? err.message : '动作失败'
  }
  finally {
    busy.value = false
  }
}

function doKick() {
  void act('kick', { user_id: kickArgs.value.user_id ? Number(kickArgs.value.user_id) : undefined, reason: kickArgs.value.reason })
  kickOpen.value = false
}

function doMove() {
  void act('force_move', { user_id: moveArgs.value.user_id ? Number(moveArgs.value.user_id) : undefined, target_room_uuid: moveArgs.value.target_room_uuid })
  moveOpen.value = false
}

function doSetChart() {
  void act('set_chart', { chart_id: setChartId.value ? Number(setChartId.value) : undefined })
  setChartOpen.value = false
}

const stateTone = (s: string) => (s === 'playing' ? 'success' : s === 'select_chart' || s === 'waiting_for_ready' ? 'warning' : 'neutral')
</script>

<template>
  <div>
    <PageHeader :title="room.data.value?.name ?? uuid" subtitle="房间详情与房主/管理员动作（§18.3）">
      <template #actions>
        <NuxtLink to="/rooms" class="text-xs text-muted hover:text-foreground">
          ← 房间列表
        </NuxtLink>
      </template>
    </PageHeader>

    <AsyncState :loading="room.loading.value" :error="room.error.value" :empty="false">
      <div class="space-y-4">
        <p v-if="actionMsg" class="text-sm text-accent" role="status">
          {{ actionMsg }}
        </p>

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
                状态
              </dt><dd>
                <UBadge :tone="stateTone(room.data.value?.state ?? '')">
                  {{ room.data.value?.state }}
                </UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                房主
              </dt><dd class="text-foreground">
                {{ room.data.value?.host_id ?? (room.data.value?.system_host ? 'system' : '—') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                成员
              </dt><dd class="text-foreground">
                {{ room.data.value?.members }}（观众 {{ room.data.value?.spectators ?? 0 }}）
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                当前谱面
              </dt><dd class="text-foreground">
                {{ room.data.value?.current_chart?.name ?? room.data.value?.current_chart?.song_name ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                当前 Round
              </dt><dd class="font-mono text-foreground">
                {{ room.data.value?.current_round_uuid ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                标签
              </dt><dd class="flex flex-wrap gap-1">
                <UBadge v-if="room.data.value?.locked" tone="warning">
                  locked
                </UBadge>
                <UBadge v-if="room.data.value?.hidden" tone="neutral">
                  hidden
                </UBadge>
                <UBadge v-if="room.data.value?.persistent" tone="accent">
                  persistent
                </UBadge>
                <UBadge v-if="room.data.value?.degraded" tone="danger">
                  degraded
                </UBadge>
                <UBadge v-if="room.data.value?.live" tone="success">
                  live
                </UBadge>
                <span v-if="!room.data.value?.locked && !room.data.value?.hidden && !room.data.value?.persistent && !room.data.value?.degraded" class="text-muted">—</span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                创建时间
              </dt><dd class="text-foreground">
                {{ formatDateTime(room.data.value?.created_at) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            动作
          </h3>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('lock')">
              锁定
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('unlock')">
              解锁
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('cycle')">
              切谱
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('set_hidden', { content: '' })">
              切换隐藏
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('set_persistent')">
              切换持久
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('set_live')">
              切换 Live
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('start')">
              开始
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('cancel_start')">
              取消开始
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('ready')">
              准备
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy" @click="setChartOpen = true">
              选谱
            </UButton>
            <UButton size="sm" variant="danger" :disabled="busy" @click="act('close')">
              关闭房间
            </UButton>
          </div>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            玩家与房主
          </h3>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" @click="kickOpen = true">
              踢出玩家
            </UButton>
            <UButton size="sm" variant="outline" @click="moveOpen = true">
              转移玩家
            </UButton>
            <UButton size="sm" variant="outline" @click="setHostOpen = true">
              设置房主
            </UButton>
            <UButton size="sm" variant="outline" @click="listOpen = true">
              名单管理
            </UButton>
          </div>
          <p class="mt-2 text-xs text-muted">
            所有动作经 Action Registry 鉴权 + 审计；每次执行重查真实 host，不信任客户端 host flag（§6/§8.5）。
          </p>
        </section>
      </div>
    </AsyncState>

    <!-- Kick modal -->
    <UModal :open="kickOpen" title="踢出玩家" width="max-w-md" @close="kickOpen = false">
      <div class="space-y-3">
        <UInput v-model="kickArgs.user_id" type="number" label="用户 ID" placeholder="phira_id" />
        <UInput v-model="kickArgs.reason" label="原因" placeholder="可选，D4 说明 reason 需另行广播" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="kickOpen = false">
            取消
          </UButton>
          <UButton variant="danger" @click="doKick">
            踢出
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Move modal -->
    <UModal :open="moveOpen" title="转移玩家" width="max-w-md" @close="moveOpen = false">
      <div class="space-y-3">
        <UInput v-model="moveArgs.user_id" type="number" label="用户 ID" placeholder="phira_id" />
        <UInput v-model="moveArgs.target_room_uuid" label="目标房间 UUID" placeholder="目标房" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="moveOpen = false">
            取消
          </UButton>
          <UButton variant="primary" @click="doMove">
            转移
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Set chart modal -->
    <UModal :open="setChartOpen" title="设置谱面" width="max-w-md" @close="setChartOpen = false">
      <div class="space-y-3">
        <UInput v-model="setChartId" type="number" label="谱面 ID" placeholder="chart id" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="setChartOpen = false">
            取消
          </UButton>
          <UButton variant="primary" @click="doSetChart">
            设置
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Set host modal -->
    <UModal :open="setHostOpen" title="设置房主" width="max-w-md" @close="setHostOpen = false">
      <div class="space-y-3">
        <UInput v-model="hostId" type="number" label="房主 Phira ID" placeholder="目标房主 id" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="setHostOpen = false">
            取消
          </UButton>
          <UButton variant="primary" @click="doSetHost">
            设置
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Whitelist / blacklist modal -->
    <UModal :open="listOpen" title="名单管理" width="max-w-md" @close="listOpen = false">
      <div class="space-y-3">
        <USelect
          v-model="listAction"
          label="动作"
          :options="[
            { label: '白名单：添加', value: 'whitelist_add' },
            { label: '白名单：移除', value: 'whitelist_remove' },
            { label: '黑名单：封禁', value: 'blacklist_ban' },
            { label: '黑名单：解封', value: 'blacklist_unban' },
          ]"
        />
        <UInput v-model="listUserId" type="number" label="用户 Phira ID" placeholder="目标用户 id" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="listOpen = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="!listUserId" @click="doListAction">
            执行
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
