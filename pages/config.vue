<script setup lang="ts">
import type { ConfigValidationIssue } from '~/features/config/types'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { diffConfig, fetchConfigDescriptors, fetchConfigRaw, fetchConfigSnapshots, fetchConfigValues, rollbackConfig, saveConfig, validateConfig } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import PPSection from '~/components/patterns/PPSection.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPSwitch from '~/components/ui/PPSwitch.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['config:view'] })

const reauth = useReauth()
const { t } = usePanelI18n()

const descriptors = useAsync(() => fetchConfigDescriptors())
const values = useAsync(() => fetchConfigValues())
const snapshots = useAsync(() => fetchConfigSnapshots())

const form = reactive<Record<string, any>>({})
const notice = useNotice()
const busy = ref(false)
const validationErrors = ref<ConfigValidationIssue[]>([])
const rawModal = ref(false)
const rawText = ref('')
const rawLoading = ref(false)
const rawError = ref<Error | null>(null)
const diffModal = ref(false)
const diffData = ref<Array<{ path: string, old: unknown, new: unknown }>>([])
const rollbackTarget = ref<string | null>(null)

// --- Secret status (§20.1 / §23 #1): only configured / missing / replace, never echo. ---
const replaceSecrets = ref(new Set<string>())
const secretValue = reactive<Record<string, string>>({})

// §23 #1: PPB returns `[REDACTED]` (uppercase) for configured secrets. Any
// non-empty value — including a redaction sentinel — means "configured".
function secretStatus(path: string): 'configured' | 'missing' {
  const v = form[path]
  const empty = v === undefined || v === null || v === ''
  return empty ? 'missing' : 'configured'
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

onMounted(() => {
  void snapshots.run()
})

// Original values, captured on load — used for dirty tracking (§23 #1: submit
// only fields the user actually changed; never write `[REDACTED]` back).
const original = reactive<Record<string, unknown>>({})

// Populate the form from `GET /config/values` → `{version, values}`.
watch(() => values.data.value, (v) => {
  if (v?.values) {
    for (const [k, val] of Object.entries(v.values)) {
      form[k] = val
      original[k] = val
    }
  }
}, { immediate: true })

/** Changed fields only (§23 #1: patch, not full-rebuild) + replacement secrets. */
const formValues = computed<Record<string, unknown>>(() => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(form)) {
    if (!(k in original) || v !== original[k])
      out[k] = v
  }
  for (const p of replaceSecrets.value) {
    if (secretValue[p]?.length)
      out[p] = secretValue[p]
  }
  return out
})

const groups = computed(() => descriptors.data.value?.groups ?? [])

const reloadTone = (r: string) => (r === 'hot' ? 'success' : r === 'restart' ? 'warning' : 'danger')
const isEditable = (reloadSemantics: string) => reloadSemantics === 'hot'

function validationMessage(item: ConfigValidationIssue): string {
  const key = `configPage.validationCodes.${item.code}`
  const translated = t(key, item.params ?? {})
  return translated === key ? t('configPage.validationUnknown') : translated
}

async function previewDiff() {
  busy.value = true
  try {
    const res = await diffConfig(formValues.value)
    diffData.value = res.changes
    diffModal.value = true
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'config:diff:error' })
  }
  finally {
    busy.value = false
  }
}

async function doSave(reauthToken?: string) {
  busy.value = true
  validationErrors.value = []
  try {
    const v = await validateConfig(formValues.value)
    if (!v.ok) {
      validationErrors.value = v.errors
      return
    }
    await saveConfig(formValues.value, reauthToken)
    replaceSecrets.value = new Set()
    notice.success('notice.configApplied', { dedupKey: 'config:save' })
    diffModal.value = false
    void snapshots.run()
    void values.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'config:save:error' })
  }
  finally {
    busy.value = false
  }
}

// Config save is a critical mutation: Diff -> Save -> Reauth -> server-enforced save.
function submitSave() {
  reauth.requireReauth(async (token) => {
    await doSave(token)
  }, 'critical')
}

async function loadRaw(): Promise<void> {
  rawLoading.value = true
  rawError.value = null
  try { rawText.value = await fetchConfigRaw() }
  catch (err) { rawError.value = err instanceof Error ? err : new Error('INVALID_RESPONSE') }
  finally { rawLoading.value = false }
}
function openRaw() {
  rawText.value = ''
  rawError.value = null
  rawModal.value = true
  void loadRaw()
}

async function doRollback(reauthToken?: string) {
  if (!rollbackTarget.value)
    return
  busy.value = true
  try {
    await rollbackConfig(rollbackTarget.value, reauthToken)
    notice.success('notice.configRolledBack', { dedupKey: 'config:rollback' })
    rollbackTarget.value = null
    void snapshots.run()
    void values.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'config:rollback:error' })
  }
  finally {
    busy.value = false
  }
}

// §23 #10: config rollback requires reauth.
function submitRollback() {
  reauth.requireReauth(async (token) => {
    await doRollback(token)
  })
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('configPage.title')" :subtitle="t('configPage.subtitle')" />

    <nav class="flex gap-1 overflow-x-auto border-b border-border pb-2" :aria-label="t('configPage.sections')">
      <a
        v-for="group in groups"
        :key="group.key"
        :href="`#config-${group.key}`"
        class="min-h-11 shrink-0 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {{ group.label }}
      </a>
      <a href="#config-snapshots" class="min-h-11 shrink-0 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {{ t('configPage.snapshots') }}
      </a>
    </nav>

    <div v-if="validationErrors.length" class="rounded border border-warning/40 bg-warning/5 px-3 py-2 text-sm" role="alert">
      <p class="font-medium text-warning">
        {{ t('configPage.validation') }}
      </p>
      <ul class="mt-1 space-y-0.5 text-xs text-muted">
        <li v-for="item in validationErrors" :key="`${item.path}:${item.code}`">
          {{ item.path ? `${item.path}: ` : '' }}{{ validationMessage(item) }}
        </li>
      </ul>
    </div>

    <AsyncState :loading="descriptors.loading.value || values.loading.value" :error="descriptors.error.value || values.error.value" :empty="false">
      <div class="space-y-4">
        <div v-for="group in groups" :id="`config-${group.key}`" :key="group.key" class="scroll-mt-20">
          <PPSection :title="group.label">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div v-for="d in group.fields" :key="d.path">
                <div class="mb-1 flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground">{{ d.label }}</span>
                  <PPBadge :tone="reloadTone(d.reload_semantics)">
                    {{ d.reload_semantics }}
                  </PPBadge>
                  <PPBadge v-if="d.sensitive" tone="warning">
                    {{ t('configPage.secret') }}
                  </PPBadge>
                </div>
                <p v-if="d.description" class="mb-1 text-xs text-muted">
                  {{ d.description }}
                </p>

                <!-- secret → configured / missing / replace（不回显原值，§20.1） -->
                <div v-if="d.sensitive" class="flex flex-wrap items-center gap-2">
                  <PPStatus :tone="secretStatus(d.path) === 'configured' ? 'success' : 'warning'">
                    {{ secretStatus(d.path) === 'configured' ? t('configPage.configured') : t('configPage.missing') }}
                  </PPStatus>
                  <template v-if="replaceSecrets.has(d.path)">
                    <PPInput
                      v-model="secretValue[d.path]"
                      type="password"
                      :placeholder="t('configPage.newSecret')"
                      class="w-56"
                    />
                    <PPButton size="sm" weight="quiet" @click="toggleReplace(d.path)">
                      {{ t('common.cancel') }}
                    </PPButton>
                  </template>
                  <PPButton
                    v-else
                    size="sm"
                    weight="secondary"
                    :disabled="!isEditable(d.reload_semantics)"
                    @click="toggleReplace(d.path)"
                  >
                    {{ secretStatus(d.path) === 'configured' ? t('configPage.replace') : t('configPage.configure') }}
                  </PPButton>
                </div>
                <!-- boolean → switch -->
                <PPSwitch
                  v-else-if="d.type === 'boolean'"
                  v-model="form[d.path]"
                  :disabled="!isEditable(d.reload_semantics)"
                />
                <!-- number -->
                <PPInput
                  v-else-if="d.type === 'number'"
                  v-model="form[d.path]"
                  type="number"
                  :disabled="!isEditable(d.reload_semantics)"
                  :placeholder="String(form[d.path] ?? '')"
                />
                <!-- textarea / yaml -->
                <PPTextarea
                  v-else-if="d.widget === 'textarea' || d.widget === 'yaml'"
                  v-model="form[d.path]"
                  :rows="d.widget === 'textarea' ? 3 : 5"
                  :mono="d.widget === 'yaml'"
                  :placeholder="String(form[d.path] ?? '')"
                  :disabled="!isEditable(d.reload_semantics)"
                />
                <!-- string / text fallback -->
                <PPInput
                  v-else
                  v-model="form[d.path]"
                  :disabled="!isEditable(d.reload_semantics)"
                  :placeholder="String(form[d.path] ?? '')"
                />
                <p v-if="!isEditable(d.reload_semantics)" class="mt-1 text-[11px] text-warning">
                  {{ t('configPage.reloadRequired', { mode: d.reload_semantics }) }}
                </p>
              </div>
            </div>
          </PPSection>
        </div>

        <div id="config-snapshots" class="scroll-mt-20">
          <PPSection :title="t('configPage.snapshots')">
            <AsyncState :loading="snapshots.loading.value" :error="snapshots.error.value" :empty="(snapshots.data.value?.items ?? []).length === 0">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-border text-xs uppercase text-muted">
                    <th class="px-2 py-1">
                      ID
                    </th><th class="px-2 py-1">
                      {{ t('configPage.note') }}
                    </th><th class="px-2 py-1">
                      {{ t('configPage.scope') }}
                    </th><th class="px-2 py-1">
                      {{ t('configPage.time') }}
                    </th><th class="px-2 py-1">
                      {{ t('configPage.actions') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in snapshots.data.value?.items ?? []" :key="s.id" class="border-b border-border last:border-0">
                    <td class="px-2 py-1.5 font-mono text-muted">
                      {{ s.id.slice(0, 8) }}
                    </td>
                    <td class="px-2 py-1.5">
                      {{ s.note || '' }}
                    </td>
                    <td class="px-2 py-1.5 text-muted">
                      {{ s.scope }}
                    </td>
                    <td class="px-2 py-1.5 text-muted">
                      {{ formatDateTime(s.created_at) }}
                    </td>
                    <td class="px-2 py-1.5">
                      <PPButton size="sm" weight="secondary" @click="rollbackTarget = s.id">
                        {{ t('configPage.rollback') }}
                      </PPButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </AsyncState>
          </PPSection>
        </div>
      </div>
    </AsyncState>

    <div class="sticky bottom-3 z-[var(--pp-z-sticky)] flex items-center justify-end gap-2 rounded-lg border border-border bg-canvas/95 px-3 py-2 shadow-lg backdrop-blur">
      <PPButton size="sm" weight="secondary" @click="openRaw">
        {{ t('configPage.rawTitle') }}
      </PPButton>
      <PPButton size="sm" weight="primary" :disabled="busy" @click="previewDiff">
        {{ t('configPage.diff') }}
      </PPButton>
    </div>

    <!-- Diff preview modal -->
    <PPModal :open="diffModal" :title="t('configPage.diffTitle')" width="max-w-2xl" @close="diffModal = false">
      <p v-if="diffData.length === 0" class="text-sm text-muted">
        {{ t('configPage.noChanges') }}
      </p>
      <ul class="space-y-1 text-sm">
        <li v-for="d in diffData" :key="d.path" class="rounded border border-border p-2">
          <span class="font-medium text-foreground">{{ d.path }}</span>
          <p class="text-xs text-muted">
            {{ t('configPage.oldNew', { old: String(d.old), new: String(d.new) }) }}
          </p>
        </li>
      </ul>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="diffModal = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy" @click="submitSave">
            {{ t('configPage.saveSnapshot') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Raw YAML modal (read-only) -->
    <PPModal :open="rawModal" :title="t('configPage.rawTitle')" width="max-w-2xl" @close="rawModal = false">
      <AsyncState :loading="rawLoading" :error="rawError">
        <PPTextarea :model-value="rawText" :rows="16" mono :label="t('configPage.rawLabel')" disabled />
        <p class="mt-2 text-xs text-muted">
          {{ t('configPage.rawHint') }}
        </p>
      </AsyncState>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton v-if="rawError" weight="secondary" @click="loadRaw">
            {{ t('common.retry') }}
          </PPButton>
          <PPButton weight="quiet" @click="rawModal = false">
            {{ t('common.close') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Rollback confirm -->
    <PPModal :open="!!rollbackTarget" :title="t('configPage.rollbackTitle')" width="max-w-md" @close="rollbackTarget = null">
      <p class="text-sm text-foreground">
        {{ t('configPage.rollbackHint', { id: rollbackTarget?.slice(0, 8) ?? t('common.unknown') }) }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="rollbackTarget = null">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="submitRollback">
            {{ t('configPage.rollback') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <ReauthModal
      :open="reauth.open.value"
      :busy="reauth.busy.value"
      :error="reauth.error.value"
      :password="reauth.password.value"
      @update:password="v => reauth.password.value = v"
      @confirm="reauth.confirm()"
      @cancel="reauth.cancel()"
    />
  </div>
</template>
