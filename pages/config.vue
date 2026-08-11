<script setup lang="ts">
import type { ConfigFieldDescriptor } from '~/types/admin'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { diffConfig, fetchConfigDescriptors, fetchConfigRaw, fetchConfigSnapshots, fetchConfigValues, rollbackConfig, saveConfig, saveConfigRaw, validateConfig } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UCard from '~/components/ui/UCard.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import USelect from '~/components/ui/USelect.vue'
import USwitch from '~/components/ui/USwitch.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['config:view'] })

const descriptors = useAsync(() => fetchConfigDescriptors())
const values = useAsync(() => fetchConfigValues())
const snapshots = useAsync(() => fetchConfigSnapshots())

const form = reactive<Record<string, any>>({})
const msg = ref('')
const busy = ref(false)
const rawModal = ref(false)
const rawText = ref('')
const diffModal = ref(false)
const diffData = ref<{ path: string, from: unknown, to: unknown }[]>([])
const rollbackTarget = ref<string | null>(null)

// --- Secret status (design §20.1): only configured / missing / replace, never echo original. ---
const replaceSecrets = ref(new Set<string>())
const secretValue = reactive<Record<string, string>>({})

const REDACTED_SENTINELS = ['******', '***', '__REDACTED__', '[redacted]', '••••••••']

function secretStatus(path: string): 'configured' | 'missing' {
  const v = form[path]
  const has = v !== undefined && v !== null && v !== '' && !REDACTED_SENTINELS.includes(String(v))
  return has ? 'configured' : 'missing'
}

function toggleReplace(path: string) {
  const s = new Set(replaceSecrets.value)
  if (s.has(path)) {
    s.delete(path)
    delete secretValue[path]
  }
  else {
    s.add(path)
    secretValue[path] = ''
  }
  replaceSecrets.value = s
}

/** Save payload = form values overlaid with any replacement secret input. */
const formValues = computed<Record<string, unknown>>(() => {
  const out: Record<string, unknown> = { ...form }
  for (const p of replaceSecrets.value) {
    if (secretValue[p]?.length)
      out[p] = secretValue[p]
  }
  return out
})

onMounted(() => {
  void snapshots.run()
})

watch(() => values.data.value, (v) => {
  if (v) {
    for (const [k, val] of Object.entries(v))
      form[k] = val
  }
}, { immediate: true })

const byGroup = computed(() => {
  const map = new Map<string, ConfigFieldDescriptor[]>()
  for (const d of descriptors.data.value ?? [])
    (map.get(d.group) ?? map.set(d.group, []).get(d.group)!).push(d)
  return map
})

const groups = computed(() => [...byGroup.value.keys()])

const reloadTone = (r: string) => (r === 'hot' ? 'success' : r === 'restart' ? 'warning' : 'danger')

async function previewDiff() {
  msg.value = ''
  busy.value = true
  try {
    const res = await diffConfig(formValues.value)
    diffData.value = res.modified
    diffModal.value = true
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '对比失败'
  }
  finally {
    busy.value = false
  }
}

async function doSave() {
  msg.value = ''
  busy.value = true
  try {
    const v = await validateConfig(formValues.value)
    if (!v.ok) {
      msg.value = v.errors.map(e => `${e.path}: ${e.message}`).join('；')
      return
    }
    await saveConfig(formValues.value)
    replaceSecrets.value = new Set()
    msg.value = '已保存（含快照）'
    diffModal.value = false
    void snapshots.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '保存失败'
  }
  finally {
    busy.value = false
  }
}

function openRaw() {
  rawText.value = ''
  void fetchConfigRaw()
    .then((t) => {
      rawText.value = t
    })
    .catch(() => {
      rawText.value = ''
    })
  rawModal.value = true
}

async function saveRaw() {
  busy.value = true
  msg.value = ''
  try {
    await saveConfigRaw(rawText.value)
    msg.value = 'Raw YAML 已保存'
    rawModal.value = false
    void values.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '保存失败'
  }
  finally {
    busy.value = false
  }
}

async function doRollback() {
  if (!rollbackTarget.value)
    return
  busy.value = true
  msg.value = ''
  try {
    await rollbackConfig(rollbackTarget.value)
    msg.value = '已回滚快照'
    rollbackTarget.value = null
    void snapshots.run()
    void values.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '回滚失败'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="配置" subtitle="Form Descriptor 渲染 · hot 可编辑 · restart 只读 · Raw YAML 高级入口（§20）">
      <template #actions>
        <UButton size="sm" variant="outline" @click="openRaw">
          Raw YAML
        </UButton>
        <UButton size="sm" variant="primary" :disabled="busy" @click="previewDiff">
          Diff 预览
        </UButton>
      </template>
    </PageHeader>

    <AsyncState :loading="descriptors.loading.value || values.loading.value" :error="descriptors.error.value || values.error.value" :empty="false">
      <p v-if="msg" class="mb-2 text-sm text-accent" role="status">
        {{ msg }}
      </p>

      <div class="space-y-4">
        <UCard v-for="group in groups" :key="group" :title="group">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div v-for="d in byGroup.get(group)" :key="d.path">
              <div class="mb-1 flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{{ d.label }}</span>
                <UBadge :tone="reloadTone(d.reload)">
                  {{ d.reload }}
                </UBadge>
                <UBadge v-if="d.sensitive" tone="warning">
                  secret
                </UBadge>
                <UBadge v-if="d.deprecated" tone="neutral">
                  deprecated
                </UBadge>
              </div>
              <p v-if="d.description" class="mb-1 text-xs text-muted">
                {{ d.description }}
              </p>

              <!-- switch -->
              <USwitch v-if="d.widget === 'switch'" v-model="form[d.path]" :disabled="d.reload !== 'hot'" />
              <!-- number -->
              <UInput
                v-else-if="d.widget === 'number'"
                v-model="form[d.path]"
                type="number"
                :disabled="d.reload !== 'hot'"
                :placeholder="String(form[d.path] ?? '')"
              />
              <!-- select -->
              <USelect
                v-else-if="d.widget === 'select'"
                v-model="form[d.path]"
                :options="d.enum ?? []"
                :disabled="d.reload !== 'hot'"
              />
              <!-- secret → configured / missing / replace（不回显原值，§20.1） -->
              <div v-else-if="d.widget === 'secret'" class="flex flex-wrap items-center gap-2">
                <UBadge :tone="secretStatus(d.path) === 'configured' ? 'success' : 'warning'">
                  {{ secretStatus(d.path) === 'configured' ? '已配置' : '未配置' }}
                </UBadge>
                <template v-if="replaceSecrets.has(d.path)">
                  <UInput
                    v-model="secretValue[d.path]"
                    type="password"
                    placeholder="输入新值（不回显）"
                    class="w-56"
                  />
                  <UButton size="sm" variant="ghost" @click="toggleReplace(d.path)">
                    取消
                  </UButton>
                </template>
                <UButton
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="d.reload !== 'hot'"
                  @click="toggleReplace(d.path)"
                >
                  {{ secretStatus(d.path) === 'configured' ? '替换' : '配置' }}
                </UButton>
              </div>
              <!-- textarea / yaml -->
              <UTextarea
                v-else
                v-model="form[d.path]"
                :rows="d.widget === 'textarea' ? 3 : 5"
                :mono="d.widget === 'yaml'"
                :placeholder="String(form[d.path] ?? '')"
                :disabled="d.reload !== 'hot'"
              />
              <p v-if="d.reload !== 'hot'" class="mt-1 text-[11px] text-warning">
                需要 {{ d.reload }}，保存后由部署适配器处理。
              </p>
            </div>
          </div>
        </UCard>

        <UCard title="快照 / 回滚">
          <AsyncState :loading="snapshots.loading.value" :error="snapshots.error.value" :empty="(snapshots.data.value ?? []).length === 0">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-border text-xs uppercase text-muted">
                  <th class="px-2 py-1">
                    ID
                  </th><th class="px-2 py-1">
                    标签
                  </th><th class="px-2 py-1">
                    时间
                  </th><th class="px-2 py-1">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in snapshots.data.value ?? []" :key="s.id" class="border-b border-border last:border-0">
                  <td class="px-2 py-1.5 font-mono text-muted">
                    {{ s.id.slice(0, 8) }}
                  </td>
                  <td class="px-2 py-1.5">
                    {{ s.label }}
                  </td>
                  <td class="px-2 py-1.5 text-muted">
                    {{ formatDateTime(s.created_at) }}
                  </td>
                  <td class="px-2 py-1.5">
                    <UButton size="sm" variant="outline" @click="rollbackTarget = s.id">
                      回滚
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </AsyncState>
        </UCard>
      </div>
    </AsyncState>

    <!-- Diff preview modal -->
    <UModal :open="diffModal" title="配置变更预览" width="max-w-2xl" @close="diffModal = false">
      <p v-if="diffData.length === 0" class="text-sm text-muted">
        无变更。
      </p>
      <ul class="space-y-1 text-sm">
        <li v-for="d in diffData" :key="d.path" class="rounded border border-border p-2">
          <span class="font-medium text-foreground">{{ d.path }}</span>
          <p class="text-xs text-muted">
            旧：{{ String(d.from) }} → 新：{{ String(d.to) }}
          </p>
        </li>
      </ul>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="diffModal = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy" @click="doSave">
            保存（含快照）
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Raw YAML modal -->
    <UModal :open="rawModal" title="Raw YAML（高级 / Developer / Root）" width="max-w-2xl" @close="rawModal = false">
      <UTextarea v-model="rawText" :rows="16" mono label="配置 YAML" />
      <p class="mt-2 text-xs text-muted">
        Raw 编辑适合高级操作；保存走校验 + 快照（§20.3）。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="rawModal = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy" @click="saveRaw">
            保存
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Rollback confirm -->
    <UModal :open="!!rollbackTarget" title="确认回滚" width="max-w-md" @close="rollbackTarget = null">
      <p class="text-sm text-foreground">
        回滚到快照 <b>{{ rollbackTarget?.slice(0, 8) }}</b>？将创建「回滚前」快照并重新加载配置。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="rollbackTarget = null">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="doRollback">
            回滚
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
