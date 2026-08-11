<script setup lang="ts">
import { ref } from 'vue'
import { executeCommand, fetchCommandHistory, rootReauth } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UTabs from '~/components/ui/UTabs.vue'
import { useAsync } from '~/composables/useAsync'
import { ApiError } from '~/utils/api-error'

definePageMeta({ permissions: ['pmp:cli'] })

const command = ref('')
const output = ref('')
const busy = ref(false)
const msg = ref('')
const scope = ref('personal')

// Danger detection (placeholder ruleset) — dangerous commands need confirm + reauth.
const DANGEROUS_RE = /^(?:update|shutdown|close|ban\b|plugin\s+remove|config\s+reload|set_\w+)/i
const isDangerous = () => DANGEROUS_RE.test(command.value.trim())

const confirmOpen = ref(false)
const reauthOpen = ref(false)
const reauthPassword = ref('')

const history = useAsync(() => fetchCommandHistory(scope.value as 'personal' | 'server', { pageNum: 100 }))

function switchScope(s: string) {
  scope.value = s
  void history.run()
}

async function doExecute(reauthToken?: string) {
  output.value = ''
  busy.value = true
  msg.value = ''
  try {
    const run = await executeCommand(command.value.trim(), reauthToken)
    output.value = run.output ?? run.error ?? `[${run.status}] ${run.command}`
    void history.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '执行失败'
  }
  finally {
    busy.value = false
  }
}

function submit() {
  if (!command.value.trim())
    return
  if (isDangerous()) {
    confirmOpen.value = true
  }
  else {
    void doExecute()
  }
}

function confirmDanger() {
  confirmOpen.value = false
  reauthOpen.value = true
}

async function confirmReauth() {
  busy.value = true
  msg.value = ''
  try {
    const { reauth_token } = await rootReauth(reauthPassword.value)
    reauthPassword.value = ''
    reauthOpen.value = false
    await doExecute(reauth_token)
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '重认证失败'
  }
  finally {
    busy.value = false
  }
}

// Autocomplete placeholder — based on PMP CLI surface (design §18.10); PPB
// will provide authoritative completion from PMP help later.
const SUGGESTIONS = [
  'help',
  'version',
  'config reload',
  'check-config',
  'roomcreation',
  'connections',
  'rooms list',
  'server stats',
  'server status',
  'update check',
  'update apply',
  'update cancel',
  'broadcast.all',
  'broadcast.room',
  'broadcast.user',
  'plugins list',
  'plugin enable',
  'plugin disable',
  'plugin remove',
  'runtime status',
  'runtime actors',
  'runtime persistence',
  'runtime phira',
  'logs history',
  'logs input',
]
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="PMP 控制台" subtitle="raw cli.execute · 危险命令确认 + reauth · personal/server 历史分离 · 全量 Audit（§18.10）" />

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="flex gap-2">
        <UInput
          v-model="command"
          class="flex-1"
          placeholder="输入 PMP CLI 命令，如 `rooms list`"
          list="console-suggestions"
          @keyup.enter="submit"
        />
        <datalist id="console-suggestions">
          <option v-for="s in SUGGESTIONS" :key="s" :value="s" />
        </datalist>
        <UButton variant="primary" :disabled="busy || !command.trim()" @click="submit">
          执行
        </UButton>
      </div>
      <p v-if="isDangerous()" class="mt-2 text-xs text-warning">
        危险命令：需要二次确认 + Root 重认证，执行将全量 Audit。
      </p>
      <p v-if="msg" class="mt-2 text-sm text-accent" role="status">
        {{ msg }}
      </p>
    </section>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section class="rounded-lg border border-border bg-surface p-4">
        <h3 class="mb-2 text-sm font-medium text-foreground">
          输出
        </h3>
        <pre class="max-h-96 overflow-auto rounded bg-surface-secondary p-3 font-mono text-xs text-foreground">{{ output || '（等待执行）' }}</pre>
      </section>

      <section class="rounded-lg border border-border bg-surface p-4">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">
            历史
          </h3>
          <UTabs
            :model-value="scope"
            :tabs="[
              { key: 'personal', label: 'Personal' },
              { key: 'server', label: 'Server' },
            ]"
            @update:model-value="switchScope"
          />
        </div>
        <AsyncState :loading="history.loading.value" :error="history.error.value" :empty="(history.data.value?.items ?? []).length === 0">
          <ul class="max-h-96 space-y-1 overflow-auto text-xs">
            <li v-for="c in history.data.value?.items ?? []" :key="c.command_id" class="rounded bg-surface-secondary px-2 py-1">
              <span class="font-mono text-foreground">{{ c.command }}</span>
              <span class="ml-2 text-muted">{{ c.status }}</span>
              <UBadge v-if="c.scope === 'server'" tone="info">
                server
              </UBadge>
            </li>
          </ul>
        </AsyncState>
      </section>
    </div>

    <!-- Danger confirm -->
    <UModal :open="confirmOpen" title="危险命令确认" width="max-w-md" @close="confirmOpen = false">
      <p class="text-sm text-foreground">
        命令 <code class="rounded bg-surface-secondary px-1 font-mono">{{ command }}</code> 属于危险命令。需要 Root 重认证后执行，并将全量审计。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="confirmOpen = false">
            取消
          </UButton>
          <UButton variant="danger" @click="confirmDanger">
            继续
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Reauth -->
    <UModal :open="reauthOpen" title="Root 重认证" width="max-w-md" @close="reauthOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          重新输入 Root 密码以获取短期 reauth context（P11，TTL 5 分钟）。
        </p>
        <UInput v-model="reauthPassword" type="password" label="Root 密码" autocomplete="current-password" @keyup.enter="confirmReauth" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="reauthOpen = false">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="confirmReauth">
            确认执行
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
