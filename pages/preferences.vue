<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UCard from '~/components/ui/UCard.vue'
import UInput from '~/components/ui/UInput.vue'
import USelect from '~/components/ui/USelect.vue'
import USwitch from '~/components/ui/USwitch.vue'
import { usePreferencesStore } from '~/stores/preferences'
import { ApiError } from '~/utils/api-error'

definePageMeta({ permissions: ['preference:manage'] })

const prefs = usePreferencesStore()
const msg = ref('')
const busy = ref(false)

onMounted(() => {
  if (!prefs.loaded)
    void prefs.load()
})

async function save() {
  busy.value = true
  msg.value = ''
  try {
    await prefs.save()
    msg.value = '偏好已同步到 PPB（namespace: panel，JSONB + revision）'
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '保存失败（PPB 未就绪，仅本地生效）'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="面板偏好" subtitle="namespace panel · 跨设备 PPB 同步（JSONB + revision 乐观并发）· 非仅 localStorage（§21.1）">
      <template #actions>
        <UButton size="sm" variant="primary" :disabled="busy" @click="save">
          保存
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="text-sm text-accent" role="status">
      {{ msg }}
    </p>
    <UBadge v-if="prefs.loadError" tone="warning">
      PPB 未同步（本地默认值）
    </UBadge>
    <UBadge v-else-if="prefs.loaded" tone="success">
      revision {{ prefs.revision }}
    </UBadge>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard title="仪表盘">
        <div class="space-y-3">
          <USelect
            v-model="prefs.data.dashboard_layout"
            label="布局"
            :options="[
              { label: '网格', value: 'grid' },
              { label: '列表', value: 'list' },
            ]"
          />
          <USelect
            v-model="prefs.data.density"
            label="表格密度"
            :options="[
              { label: '紧凑', value: 'compact' },
              { label: '舒适', value: 'comfortable' },
              { label: '宽松', value: 'spacious' },
            ]"
          />
          <div class="flex items-center justify-between">
            <span class="text-sm text-foreground">侧栏收起</span>
            <USwitch v-model="prefs.data.sidebar.collapsed" />
          </div>
        </div>
      </UCard>

      <UCard title="表格">
        <div class="space-y-3">
          <UInput
            :model-value="String(prefs.data.page_size)"
            type="number"
            label="每页条数"
            @update:model-value="v => { prefs.data.page_size = Number(v) }"
          />
          <USwitch v-model="prefs.data.log_wrap" label="日志自动换行" />
        </div>
      </UCard>

      <UCard title="图表（按 chart id 记忆类型与时间范围）">
        <div class="space-y-2">
          <div
            v-for="(kind, chartId) in prefs.data.per_chart_type"
            :key="chartId"
            class="flex items-center justify-between rounded border border-border p-2"
          >
            <span class="text-sm text-foreground">{{ chartId }}</span>
            <div class="flex items-center gap-2">
              <USelect
                :model-value="kind"
                :options="[
                  { label: '折线', value: 'line' },
                  { label: '柱状', value: 'bar' },
                  { label: '饼图', value: 'pie' },
                ]"
                @update:model-value="v => prefs.update({ per_chart_type: { ...prefs.data.per_chart_type, [chartId]: v as 'line' | 'bar' | 'pie' } })"
              />
              <USelect
                :model-value="prefs.data.per_chart_range[chartId] ?? '24h'"
                :options="[
                  { label: '24h', value: '24h' },
                  { label: '7d', value: '7d' },
                  { label: '30d', value: '30d' },
                ]"
                @update:model-value="v => prefs.update({ per_chart_range: { ...prefs.data.per_chart_range, [chartId]: v } })"
              />
            </div>
          </div>
          <p v-if="!Object.keys(prefs.data.per_chart_type).length" class="text-sm text-muted">
            暂无图表偏好（在仪表盘切换图表类型后会自动记录）。
          </p>
        </div>
      </UCard>

      <UCard title="控制台">
        <div class="space-y-3">
          <UInput
            :model-value="String(prefs.data.console.font_size)"
            type="number"
            label="字体大小"
            @update:model-value="v => { prefs.data.console.font_size = Number(v) }"
          />
          <UInput
            :model-value="String(prefs.data.console.history_limit)"
            type="number"
            label="本地历史条数"
            @update:model-value="v => { prefs.data.console.history_limit = Number(v) }"
          />
        </div>
      </UCard>
    </div>

    <p class="text-xs text-muted">
      设备级偏好（geometry / render_scale / cache_size / low_performance）仅存本机，不在此页（§21.2）。
    </p>
  </div>
</template>
