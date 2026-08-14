<script setup lang="ts">
import { ref } from 'vue'
import { callPlugin, fetchPlugins, pluginAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPSurface from '~/components/ui/PPSurface.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import { useAsync } from '~/composables/useAsync'

definePageMeta({ permissions: ['plugin:view'] })

const { t } = usePanelI18n()

const list = useAsync(() => fetchPlugins())
const notice = useNotice()
const fieldError = ref('')
const busy = ref(false)
const removeTarget = ref<string | null>(null)
const callTarget = ref<string | null>(null)
const callMethod = ref('')
const callArgs = ref('')

async function act(id: string, action: 'enable' | 'disable' | 'reload') {
  fieldError.value = ''
  busy.value = true
  try {
    await pluginAction(id, action)
    notice.success('notice.actionCompleted', { dedupKey: `plugin:${id}:${action}` })
    void list.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `plugin:${id}:${action}:error` })
  }
  finally {
    busy.value = false
  }
}

async function confirmRemove() {
  if (!removeTarget.value)
    return
  busy.value = true
  fieldError.value = ''
  try {
    await pluginAction(removeTarget.value, 'remove')
    notice.success('notice.removed', { dedupKey: `plugin:${removeTarget.value}:remove` })
    removeTarget.value = null
    void list.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `plugin:${removeTarget.value ?? 'unknown'}:remove:error` })
  }
  finally {
    busy.value = false
  }
}

async function doCall() {
  if (!callTarget.value)
    return
  busy.value = true
  fieldError.value = ''
  let parsed: Record<string, unknown> = {}
  if (callArgs.value.trim()) {
    try {
      parsed = JSON.parse(callArgs.value) as Record<string, unknown>
    }
    catch {
      fieldError.value = t('pluginsPage.invalidJson')
      busy.value = false
      return
    }
  }
  try {
    await callPlugin(callTarget.value, callMethod.value || undefined, parsed)
    notice.success('notice.actionCompleted', { dedupKey: `plugin:${callTarget.value}:call` })
    callTarget.value = null
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `plugin:${callTarget.value ?? 'unknown'}:call:error` })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('pluginsPage.title')" :subtitle="t('pluginsPage.subtitle')">
      <template #actions>
        <PPButton size="sm" weight="secondary" @click="list.run()">
          {{ t('pluginsPage.refresh') }}
        </PPButton>
      </template>
    </PageHeader>

    <p v-if="fieldError" class="mb-2 text-sm text-danger" role="alert">
      {{ fieldError }}
    </p>

    <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value ?? []).length === 0">
      <div class="space-y-2">
        <PPSurface v-for="p in list.data.value ?? []" :key="p.id" padded>
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-foreground">
                  {{ p.name }}
                </h3>
                <PPStatus :tone="p.enabled ? 'success' : 'neutral'">
                  {{ p.enabled ? 'enabled' : 'disabled' }}
                </PPStatus>
                <span v-if="p.version" class="text-xs text-muted">v{{ p.version }}</span>
              </div>
              <p v-if="p.description" class="mt-1 text-xs text-muted">
                {{ p.description }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(p.id, 'enable')">
                {{ t('pluginsPage.enable') }}
              </PPButton>
              <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(p.id, 'disable')">
                {{ t('pluginsPage.disable') }}
              </PPButton>
              <PPButton size="sm" weight="secondary" :disabled="busy" @click="act(p.id, 'reload')">
                {{ t('pluginsPage.reload') }}
              </PPButton>
              <PPButton size="sm" weight="secondary" :disabled="busy" @click="callTarget = p.id">
                {{ t('pluginsPage.call') }}
              </PPButton>
              <PPButton size="sm" weight="dangerous" :disabled="busy" @click="removeTarget = p.id">
                {{ t('pluginsPage.remove') }}
              </PPButton>
            </div>
          </div>
          <details v-if="p.exposed_config && Object.keys(p.exposed_config).length" class="mt-2 text-xs text-muted">
            <summary class="cursor-pointer">
              {{ t('pluginsPage.exposedConfig') }}
            </summary>
            <pre class="mt-1 overflow-auto rounded bg-surface-secondary p-2 font-mono">{{ JSON.stringify(p.exposed_config, null, 2) }}</pre>
          </details>
        </PPSurface>
      </div>
    </AsyncState>

    <!-- Remove confirm -->
    <PPModal :open="!!removeTarget" :title="t('pluginsPage.removeTitle')" width="max-w-md" @close="removeTarget = null">
      <p class="text-sm text-foreground">
        {{ t('pluginsPage.removeConfirm', { name: removeTarget ?? '' }) }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="removeTarget = null">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="confirmRemove">
            {{ t('pluginsPage.remove') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Call modal -->
    <PPModal :open="!!callTarget" :title="t('pluginsPage.callTitle')" width="max-w-md" @close="callTarget = null">
      <div class="space-y-3">
        <PPInput v-model="callMethod" :label="t('pluginsPage.method')" :placeholder="t('pluginsPage.methodPlaceholder')" />
        <PPTextarea v-model="callArgs" :label="t('common.argsJson')" :rows="4" mono placeholder="{ &quot;key&quot;: &quot;value&quot; }" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="callTarget = null">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy" @click="doCall">
            {{ t('pluginsPage.call') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
