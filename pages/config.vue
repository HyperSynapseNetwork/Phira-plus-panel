<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { diffConfig, fetchConfigDescriptors, fetchConfigRaw, fetchConfigSnapshots, fetchConfigValues, rollbackConfig, saveConfig, validateConfig } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UCard from '~/components/ui/UCard.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
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
const diffData = ref<Array<{ path: string, old: unknown, new: unknown }>>([])
const rollbackTarget = ref<string | null>(null)

// --- Secret status (§20.1): only configured / missing / replace, never echo. ---
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

/** Form values (§22 model A) overlaid with any replacement secret input. */
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

// Populate the form from `GET /config/values` → `{version, values}`.
watch(() => values.data.value, (v) => {
  if (v?.values) {
    for (const [k, val] of Object.entries(v.values))
      form[k] = val
  }
}, { immediate: true })

const groups = computed(() => descriptors.data.value?.groups ?? [])

const reloadTone = (r: string) => (r === 'hot' ? 'success' : r === 'restart' ? 'warning' : 'danger')
const isEditable = (reloadSemantics: string) => reloadSemantics === 'hot'

async function previewDiff() {
  msg.value = ''
  busy.value = true
  try {
    const res = await diffConfig(formValues.value)
    diffData.value = res.changes
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
    msg.value = '已保存（PPB 已生成 YAML 并快照）'
    diffModal.value = false
    void snapshots.run()
    void values.run()
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
    <PageHeader title="配置" subtitle="Form Descriptor 模型 A（§22）· hot 可编辑 · restart/rebuild 只读 · Raw YAML 只读查看">
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
        <UCard v-for="group in groups" :key="group.key" :title="group.label">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div v-for="d in group.fields" :key="d.path">
              <div class="mb-1 flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{{ d.label }}</span>
                <UBadge :tone="reloadTone(d.reload_semantics)">
                  {{ d.reload_semantics }}
                </UBadge>
                <UBadge v-if="d.sensitive" tone="warning">
                  secret
                </UBadge>
              </div>
              <p v-if="d.description" class="mb-1 text-xs text-muted">
                {{ d.description }}
              </p>

              <!-- secret → configured / missing / replace（不回显原值，§20.1） -->
              <div v-if="d.sensitive" class="flex flex-wrap items-center gap-2">
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
                  :disabled="!isEditable(d.reload_semantics)"
                  @click="toggleReplace(d.path)"
                >
                  {{ secretStatus(d.path) === 'configured' ? '替换' : '配置' }}
                </UButton>
              </div>
              <!-- boolean → switch -->
              <USwitch
                v-else-if="d.type === 'boolean'"
                v-model="form[d.path]"
                :disabled="!isEditable(d.reload_semantics)"
              />
              <!-- number -->
              <UInput
                v-else-if="d.type === 'number'"
                v-model="form[d.path]"
                type="number"
                :disabled="!isEditable(d.reload_semantics)"
                :placeholder="String(form[d.path] ?? '')"
              />
              <!-- textarea / yaml -->
              <UTextarea
                v-else-if="d.widget === 'textarea' || d.widget === 'yaml'"
                v-model="form[d.path]"
                :rows="d.widget === 'textarea' ? 3 : 5"
                :mono="d.widget === 'yaml'"
                :placeholder="String(form[d.path] ?? '')"
                :disabled="!isEditable(d.reload_semantics)"
              />
              <!-- string / text fallback -->
              <UInput
                v-else
                v-model="form[d.path]"
                :disabled="!isEditable(d.reload_semantics)"
                :placeholder="String(form[d.path] ?? '')"
              />
              <p v-if="!isEditable(d.reload_semantics)" class="mt-1 text-[11px] text-warning">
                需要 {{ d.reload_semantics }}，保存后由部署适配器处理。
              </p>
            </div>
          </div>
        </UCard>

        <UCard title="快照 / 回滚">
          <AsyncState :loading="snapshots.loading.value" :error="snapshots.error.value" :empty="(snapshots.data.value?.items ?? []).length === 0">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-border text-xs uppercase text-muted">
                  <th class="px-2 py-1">
                    ID
                  </th><th class="px-2 py-1">
                    备注
                  </th><th class="px-2 py-1">
                    作用域
                  </th><th class="px-2 py-1">
                    时间
                  </th><th class="px-2 py-1">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in snapshots.data.value?.items ?? []" :key="s.id" class="border-b border-border last:border-0">
                  <td class="px-2 py-1.5 font-mono text-muted">
                    {{ s.id.slice(0, 8) }}
                  </td>
                  <td class="px-2 py-1.5">
                    {{ s.note || '—' }}
                  </td>
                  <td class="px-2 py-1.5 text-muted">
                    {{ s.scope }}
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
            旧：{{ String(d.old) }} → 新：{{ String(d.new) }}
          </p>
        </li>
      </ul>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="diffModal = false">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy" @click="doSave">
            保存（生成 YAML + 快照）
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Raw YAML modal (read-only) -->
    <UModal :open="rawModal" title="Raw YAML（只读 · Developer / Root）" width="max-w-2xl" @close="rawModal = false">
      <UTextarea :model-value="rawText" :rows="16" mono label="当前配置 YAML（只读）" disabled />
      <p class="mt-2 text-xs text-muted">
        §22 模型 A：编辑走 Form values，PPB 负责生成 YAML；此处仅查看当前生成的 YAML。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="rawModal = false">
            关闭
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
