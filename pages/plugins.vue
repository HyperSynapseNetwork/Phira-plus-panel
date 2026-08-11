<script setup lang="ts">
import { ref } from 'vue'
import { callPlugin, fetchPlugins, pluginAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'

definePageMeta({ permissions: ['plugin:view'] })

const list = useAsync(() => fetchPlugins())
const msg = ref('')
const busy = ref(false)
const removeTarget = ref<string | null>(null)
const callTarget = ref<string | null>(null)
const callMethod = ref('')
const callArgs = ref('')

async function act(id: string, action: 'enable' | 'disable' | 'reload') {
  msg.value = ''
  busy.value = true
  try {
    await pluginAction(id, action)
    msg.value = `插件 ${id} ${action} 成功`
    void list.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '操作失败'
  }
  finally {
    busy.value = false
  }
}

async function confirmRemove() {
  if (!removeTarget.value)
    return
  busy.value = true
  msg.value = ''
  try {
    await pluginAction(removeTarget.value, 'remove')
    msg.value = `插件 ${removeTarget.value} 已移除`
    removeTarget.value = null
    void list.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '移除失败'
  }
  finally {
    busy.value = false
  }
}

async function doCall() {
  if (!callTarget.value)
    return
  busy.value = true
  msg.value = ''
  let parsed: Record<string, unknown> = {}
  if (callArgs.value.trim()) {
    try {
      parsed = JSON.parse(callArgs.value) as Record<string, unknown>
    }
    catch {
      msg.value = 'args 不是合法 JSON'
      busy.value = false
      return
    }
  }
  try {
    const res = await callPlugin(callTarget.value, callMethod.value || undefined, parsed)
    msg.value = `调用结果：${JSON.stringify(res.result ?? res)}`
    callTarget.value = null
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '调用失败'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="插件" subtitle="list / info / enable / disable / reload / remove / call（§18.8）">
      <template #actions>
        <UButton size="sm" variant="outline" @click="list.run()">
          刷新
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="mb-2 text-sm text-accent" role="status">
      {{ msg }}
    </p>

    <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value ?? []).length === 0">
      <div class="space-y-2">
        <section v-for="p in list.data.value ?? []" :key="p.id" class="rounded-lg border border-border bg-surface p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-foreground">
                  {{ p.name }}
                </h3>
                <UBadge :tone="p.enabled ? 'success' : 'neutral'">
                  {{ p.enabled ? 'enabled' : 'disabled' }}
                </UBadge>
                <span v-if="p.version" class="text-xs text-muted">v{{ p.version }}</span>
              </div>
              <p v-if="p.description" class="mt-1 text-xs text-muted">
                {{ p.description }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="sm" variant="outline" :disabled="busy" @click="act(p.id, 'enable')">
                启用
              </UButton>
              <UButton size="sm" variant="outline" :disabled="busy" @click="act(p.id, 'disable')">
                停用
              </UButton>
              <UButton size="sm" variant="outline" :disabled="busy" @click="act(p.id, 'reload')">
                重载
              </UButton>
              <UButton size="sm" variant="outline" :disabled="busy" @click="callTarget = p.id">
                调用
              </UButton>
              <UButton size="sm" variant="danger" :disabled="busy" @click="removeTarget = p.id">
                移除
              </UButton>
            </div>
          </div>
          <details v-if="p.exposed_config && Object.keys(p.exposed_config).length" class="mt-2 text-xs text-muted">
            <summary class="cursor-pointer">
              Exposed config
            </summary>
            <pre class="mt-1 overflow-auto rounded bg-surface-secondary p-2 font-mono">{{ JSON.stringify(p.exposed_config, null, 2) }}</pre>
          </details>
        </section>
      </div>
    </AsyncState>

    <!-- Remove confirm -->
    <UModal :open="!!removeTarget" title="确认移除插件" width="max-w-md" @close="removeTarget = null">
      <p class="text-sm text-foreground">
        移除插件 <b>{{ removeTarget }}</b> 是不可逆破坏性操作（§18.8）。确认？
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="removeTarget = null">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="confirmRemove">
            移除
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Call modal -->
    <UModal :open="!!callTarget" title="调用插件" width="max-w-md" @close="callTarget = null">
      <div class="space-y-3">
        <UInput v-model="callMethod" label="方法" placeholder="插件方法名（可选）" />
        <UTextarea v-model="callArgs" label="Args (JSON)" :rows="4" mono placeholder="{ &quot;key&quot;: &quot;value&quot; }" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="callTarget = null">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy" @click="doCall">
            调用
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
