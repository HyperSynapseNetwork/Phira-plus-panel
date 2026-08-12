<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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

// --- card order (§21.1 dashboard layout/card_order) ---
const newCardId = ref('')

function addCard() {
  const id = newCardId.value.trim()
  if (id && !prefs.data.card_order.includes(id))
    prefs.update({ card_order: [...prefs.data.card_order, id] })
  newCardId.value = ''
}

function removeCard(id: string) {
  prefs.update({ card_order: prefs.data.card_order.filter(c => c !== id) })
}

function moveCard(id: string, dir: -1 | 1) {
  const arr = [...prefs.data.card_order]
  const i = arr.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) {
    return
  }
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  prefs.update({ card_order: arr })
}

// --- table columns (per-table) ---
const tableColsDraft = reactive<Record<string, string>>({})
const newTableId = ref('')

function initTableDrafts() {
  for (const [id, cols] of Object.entries(prefs.data.table_columns))
    tableColsDraft[id] = cols.join(', ')
}

function addTable() {
  const id = newTableId.value.trim()
  if (id && !(id in prefs.data.table_columns)) {
    prefs.update({ table_columns: { ...prefs.data.table_columns, [id]: [] } })
    tableColsDraft[id] = ''
  }
  newTableId.value = ''
}

function removeTable(id: string) {
  const t = { ...prefs.data.table_columns }
  delete t[id]
  delete tableColsDraft[id]
  prefs.update({ table_columns: t })
}

function commitTableCols(id: string) {
  const text = tableColsDraft[id] ?? ''
  prefs.update({
    table_columns: { ...prefs.data.table_columns, [id]: text.split(',').map(s => s.trim()).filter(Boolean) },
  })
}

// --- log levels ---
const LOG_LEVELS = ['debug', 'info', 'warn', 'error']

function toggleLevel(level: string) {
  const set = new Set(prefs.data.log_levels)
  if (set.has(level)) {
    set.delete(level)
  }
  else {
    set.add(level)
  }
  prefs.update({ log_levels: [...set] })
}

onMounted(() => {
  if (!prefs.loaded)
    void prefs.load()
  initTableDrafts()
})

async function save() {
  // Commit any in-flight table column drafts before saving.
  for (const id of Object.keys(tableColsDraft))
    commitTableCols(id)
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
          <div>
            <p class="mb-1 text-sm font-medium text-foreground">
              卡片顺序（card_order）
            </p>
            <ul class="space-y-1">
              <li
                v-for="(id, i) in prefs.data.card_order"
                :key="id"
                class="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span class="font-mono text-xs text-foreground">{{ i + 1 }}. {{ id }}</span>
                <span class="flex gap-1">
                  <UButton size="sm" variant="ghost" :disabled="i === 0" @click="moveCard(id, -1)">
                    ↑
                  </UButton>
                  <UButton size="sm" variant="ghost" :disabled="i === prefs.data.card_order.length - 1" @click="moveCard(id, 1)">
                    ↓
                  </UButton>
                  <UButton size="sm" variant="danger" @click="removeCard(id)">
                    移除
                  </UButton>
                </span>
              </li>
            </ul>
            <p v-if="!prefs.data.card_order.length" class="text-xs text-muted">
              暂无卡片顺序（在仪表盘切换图表类型后会自动记录）。
            </p>
            <div class="mt-1 flex gap-2">
              <UInput v-model="newCardId" placeholder="chart id，如 online_users" class="flex-1" />
              <UButton size="sm" variant="outline" @click="addCard">
                添加
              </UButton>
            </div>
          </div>
        </div>
      </UCard>

      <UCard title="表格 / 日志">
        <div class="space-y-3">
          <UInput
            :model-value="String(prefs.data.page_size)"
            type="number"
            label="每页条数"
            @update:model-value="v => { prefs.data.page_size = Number(v) }"
          />
          <USwitch v-model="prefs.data.log_wrap" label="日志自动换行" />
          <USwitch v-model="prefs.data.log_autoscroll" label="日志 Live 自动滚动" />
          <div>
            <p class="mb-1 text-sm font-medium text-foreground">
              日志默认级别
            </p>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="l in LOG_LEVELS"
                :key="l"
                class="flex items-center gap-1.5 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  class="rounded"
                  :checked="prefs.data.log_levels.includes(l)"
                  @change="toggleLevel(l)"
                >
                {{ l }}
              </label>
            </div>
          </div>
          <div>
            <p class="mb-1 text-sm font-medium text-foreground">
              表格列（table_columns，每表逗号分隔）
            </p>
            <div v-for="(_, id) in prefs.data.table_columns" :key="id" class="mb-1 flex items-center gap-2">
              <span class="w-24 truncate font-mono text-xs text-muted">{{ id }}</span>
              <UInput
                :model-value="tableColsDraft[id] ?? ''"
                class="flex-1"
                placeholder="col1, col2"
                @update:model-value="v => { tableColsDraft[id] = v }"
                @blur="commitTableCols(id)"
              />
              <UButton size="sm" variant="danger" @click="removeTable(id)">
                移除
              </UButton>
            </div>
            <div class="flex gap-2">
              <UInput v-model="newTableId" placeholder="table id，如 users" class="flex-1" />
              <UButton size="sm" variant="outline" @click="addTable">
                添加
              </UButton>
            </div>
          </div>
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

      <UCard title="性能 / 可访问性">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-foreground">
                低性能模式
              </p>
              <p class="text-xs text-muted">
                禁用 ECharts 动画与重效果（§22.8）。
              </p>
            </div>
            <USwitch v-model="prefs.data.low_performance" />
          </div>
          <p class="text-xs text-muted">
            系统级 reduced-motion / reduced-transparency 由 CSS media query 自动生效（§22.7）。
          </p>
        </div>
      </UCard>

      <UCard title="实验性功能（§22.5）">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-foreground">
                Desktop Window
              </p>
              <p class="text-xs text-muted">
                默认关闭。启用后顶栏出现「窗口」，支持拖拽 / 缩放 / 多窗口并列；x/y/w/h 仅存本机（device pref）。
              </p>
            </div>
            <USwitch v-model="prefs.data.desktop_window.enabled" />
          </div>
          <p class="text-xs text-muted">
            Android 不提供或自动降级隐藏。
          </p>
        </div>
      </UCard>
    </div>

    <p class="text-xs text-muted">
      设备级偏好（geometry / render_scale / cache_size / low_performance）仅存本机，不在此页（§21.2）。
    </p>
  </div>
</template>
