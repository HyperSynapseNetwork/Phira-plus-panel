<script setup lang="ts">
import { ref } from 'vue'
import { executeCommand, fetchCommandHistory, rootReauth } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPSurface from '~/components/ui/PPSurface.vue'
import PPTabs from '~/components/ui/PPTabs.vue'
import { useAsync } from '~/composables/useAsync'
import { commandStatusLabel } from '~/features/console/labels'

definePageMeta({ permissions: ['pmp:cli'] })

const { t } = usePanelI18n()

const command = ref('')
const output = ref('')
const busy = ref(false)
const notice = useNotice()
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
  try {
    const run = await executeCommand(command.value.trim(), reauthToken)
    output.value = run.output ?? run.error ?? `[${run.status}] ${run.command}`
    notice.success('notice.commandCompleted', { dedupKey: 'console:command' })
    void history.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'console:command:error' })
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
  try {
    const { reauth_token } = await rootReauth(reauthPassword.value)
    reauthPassword.value = ''
    reauthOpen.value = false
    await doExecute(reauth_token)
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'console:reauth:error' })
  }
  finally {
    busy.value = false
  }
}

// Offline completion fallback based on PMP's documented CLI surface. Command
// execution remains server-authoritative and fully audited by PPB.
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
    <PageHeader :title="t('consolePage.title')" :subtitle="t('consolePage.subtitle')" />

    <PPSurface padded>
      <div class="flex gap-2">
        <PPInput
          v-model="command"
          class="flex-1"
          :placeholder="t('consolePage.placeholder')"
          list="console-suggestions"
          @keyup.enter="submit"
        />
        <datalist id="console-suggestions">
          <option v-for="s in SUGGESTIONS" :key="s" :value="s" />
        </datalist>
        <PPButton weight="primary" :disabled="busy || !command.trim()" @click="submit">
          {{ t('consolePage.execute') }}
        </PPButton>
      </div>
      <p v-if="isDangerous()" class="mt-2 text-xs text-warning">
        {{ t('consolePage.dangerHint') }}
      </p>
    </PPSurface>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PPSurface padded>
        <h3 class="mb-2 text-sm font-medium text-foreground">
          {{ t('consolePage.output') }}
        </h3>
        <pre class="max-h-96 overflow-auto rounded bg-surface-secondary p-3 font-mono text-xs text-foreground">{{ output || t('consolePage.waiting') }}</pre>
      </PPSurface>

      <PPSurface padded>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">
            {{ t('consolePage.history') }}
          </h3>
          <PPTabs
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
              <span class="ml-2 text-muted">{{ commandStatusLabel(t, c.status) }}</span>
              <PPBadge v-if="c.scope === 'server'" tone="info">
                {{ t('consolePage.serverScope') }}
              </PPBadge>
            </li>
          </ul>
        </AsyncState>
      </PPSurface>
    </div>

    <!-- Danger confirm -->
    <PPModal :open="confirmOpen" :title="t('consolePage.dangerTitle')" width="max-w-md" @close="confirmOpen = false">
      <p class="text-sm text-foreground">
        <span>{{ t('consolePage.dangerConfirm') }}</span> <code class="rounded bg-surface-secondary px-1 font-mono">{{ command }}</code>
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="confirmOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" @click="confirmDanger">
            {{ t('consolePage.continue') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Reauth -->
    <PPModal :open="reauthOpen" :title="t('consolePage.reauthTitle')" width="max-w-md" @close="reauthOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ t('consolePage.reauthHint') }}
        </p>
        <PPInput v-model="reauthPassword" type="password" :label="t('consolePage.rootPassword')" autocomplete="current-password" @keyup.enter="confirmReauth" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="reauthOpen = false">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="confirmReauth">
            {{ t('consolePage.confirmExecute') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
  </div>
</template>
