<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchServerStatus, runServerAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import KpiCard from '~/components/admin/KpiCard.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UCard from '~/components/ui/UCard.vue'
import UModal from '~/components/ui/UModal.vue'
import USwitch from '~/components/ui/USwitch.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDuration } from '~/utils/format'

definePageMeta({ permissions: ['server:view'] })

const status = useAsync(() => fetchServerStatus())
const busy = ref(false)
const msg = ref('')
const confirmShutdown = ref(false)

const updateState = computed(() => status.data.value?.update?.state ?? 'idle')

const updateStages: Record<string, { label: string, tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  idle: { label: '空闲', tone: 'neutral' },
  checking: { label: '检查更新中…', tone: 'warning' },
  downloading: { label: '下载中（低带宽，请耐心）…', tone: 'warning' },
  verifying: { label: '校验中…', tone: 'warning' },
  applying: { label: '应用中…', tone: 'danger' },
  error: { label: '更新失败', tone: 'danger' },
}

async function act(action: Parameters<typeof runServerAction>[0], args: Record<string, unknown> = {}) {
  msg.value = ''
  busy.value = true
  try {
    await runServerAction(action, args)
    msg.value = `操作 ${action} 已提交`
    void status.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '操作失败'
  }
  finally {
    busy.value = false
  }
}

function doShutdown() {
  confirmShutdown.value = false
  void act('shutdown', { reason: 'admin' })
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="服务器" subtitle="PMP / PPB 状态 · 运行时诊断 · 更新与门控（§18.6）">
      <template #actions>
        <UButton variant="danger" size="sm" @click="confirmShutdown = true">
          关闭服务器
        </UButton>
      </template>
    </PageHeader>

    <AsyncState :loading="status.loading.value" :error="status.error.value" :empty="false">
      <div class="space-y-4">
        <p v-if="msg" class="text-sm text-accent" role="status">
          {{ msg }}
        </p>

        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="PMP" :value="status.data.value?.pmp.connected ? '已连接' : '未连接'" :tone="status.data.value?.pmp.connected ? 'success' : 'danger'" :hint="`v${status.data.value?.pmp.version ?? '—'}`" />
          <KpiCard label="PMP uptime" :value="formatDuration(status.data.value?.pmp.uptime_secs)" hint="运行时长" />
          <KpiCard label="PPB" :value="status.data.value?.ppb?.version ?? '—'" hint="后端版本" />
          <KpiCard label="房间/用户/会话" :value="`${status.data.value?.counts.rooms ?? '—'}/${status.data.value?.counts.users ?? '—'}/${status.data.value?.counts.sessions ?? '—'}`" hint="PMP 计数" />
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UCard title="运行时诊断">
            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-xs text-muted">
                  CPU
                </dt><dd class="text-foreground">
                  {{ status.data.value?.runtime?.cpu_percent ?? '—' }}%
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  内存
                </dt><dd class="text-foreground">
                  {{ status.data.value?.runtime?.memory_mb ? `${status.data.value.runtime.memory_mb} MB` : '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  磁盘
                </dt><dd class="text-foreground">
                  {{ status.data.value?.runtime?.disk_percent ?? '—' }}%
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  网络 rx/tx
                </dt><dd class="text-foreground">
                  {{ status.data.value?.runtime?.network_rx_bps ?? '—' }} / {{ status.data.value?.runtime?.network_tx_bps ?? '—' }} bps
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard title="连接与创建门控">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-foreground">连接门控</span>
                <USwitch
                  :model-value="status.data.value?.gates.connections ?? false"
                  @update:model-value="v => act('set_connections', { enabled: v })"
                />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-foreground">房间创建</span>
                <USwitch
                  :model-value="status.data.value?.gates.room_creation ?? false"
                  @update:model-value="v => act('set_room_creation', { enabled: v })"
                />
              </div>
            </div>
          </UCard>
        </div>

        <UCard title="PMP 更新（低带宽安全，§9.5）">
          <div class="flex items-center gap-3">
            <UBadge :tone="updateStages[updateState]?.tone ?? 'neutral'">
              {{ updateStages[updateState]?.label ?? updateState }}
            </UBadge>
            <span v-if="status.data.value?.update?.target_version" class="text-sm text-muted">
              {{ status.data.value.update.current_version }} → {{ status.data.value.update.target_version }}
            </span>
            <span v-if="status.data.value?.update?.progress != null" class="text-xs text-muted">
              {{ Math.round(status.data.value.update.progress * 100) }}%
            </span>
          </div>
          <p v-if="status.data.value?.update?.error" class="mt-2 text-sm text-danger">
            更新失败：{{ status.data.value.update.error }}（下载/校验失败绝不进入 apply）
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('update_check')">
              检查更新
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy || updateState !== 'idle'" @click="act('update_apply')">
              应用更新
            </UButton>
            <UButton size="sm" variant="outline" :disabled="busy || updateState === 'idle'" @click="act('update_cancel')">
              取消
            </UButton>
          </div>
        </UCard>

        <UCard title="维护与启动适配器">
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" :disabled="busy" @click="act('config_reload')">
              重载配置
            </UButton>
          </div>
          <p class="mt-2 text-xs text-muted">
            「从 Panel 启动 PMP」仅通过受控 Process Supervisor Adapter（固定 executable/service、allowlist 启动参数）——禁止任意 shell（§18.6 / §27.6）。当前部署 adapter 未配置时，此页面明确显示不支持。
          </p>
          <p class="mt-1 text-xs text-warning">
            当前 adapter 未配置 —— 不支持从 Panel 启动。
          </p>
        </UCard>
      </div>
    </AsyncState>

    <UModal :open="confirmShutdown" title="确认关闭服务器" width="max-w-md" @close="confirmShutdown = false">
      <p class="text-sm text-foreground">
        确认关闭 PMP 服务器？该操作会中断所有房间与在线玩家。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="confirmShutdown = false">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="doShutdown">
            确认关闭
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
