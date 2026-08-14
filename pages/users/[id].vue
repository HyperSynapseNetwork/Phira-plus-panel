<script setup lang="ts">
import type { AuditEvent } from '~/types/admin'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchGroups, fetchUser, fetchUserAudit, fetchUserMultiplayer, fetchUserSecurity, fetchUserSessions, runUserAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPTabs from '~/components/ui/PPTabs.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { USER_ACTION } from '~/config/action-ids'
import { usePermissionsStore } from '~/stores/permissions'
import { userStatusLabel } from '~/features/users/labels'
import { formatDateTime, formatDuration } from '~/utils/format'

definePageMeta({ permissions: ['user:view'] })

const { t } = usePanelI18n()

const route = useRoute()
// Route id is the Phira id (contract §22: `/admin/users/{phira_id}`).
const phiraId = computed(() => Number(route.params.id))

const tab = ref('overview')
const notice = useNotice()
const validationMsg = ref('')
const selectedIp = ref('')
const permStore = usePermissionsStore()

onMounted(() => {
  void permStore.load()
})

const user = useAsync(() => fetchUser(phiraId.value))
const groups = useAsync(() => fetchGroups({ pageNum: 100 }))
const multiplayer = useAsync(() => fetchUserMultiplayer(phiraId.value), { immediate: false })
const sessions = useAsync(() => fetchUserSessions(phiraId.value), { immediate: false })
const security = useAsync(() => fetchUserSecurity(phiraId.value), { immediate: false })
const audit = useAsync(() => fetchUserAudit(phiraId.value, { pageNum: 50 }), { immediate: false })

watch(tab, (t) => {
  if (t === 'multiplayer' && !multiplayer.ready.value)
    void multiplayer.run()
  if (t === 'sessions' && !sessions.ready.value)
    void sessions.run()
  if (t === 'security' && !security.ready.value)
    void security.run()
  if (t === 'audit' && !audit.ready.value)
    void audit.run()
})

const account = computed(() => user.data.value?.account)

// §23 #3: `groups` is `GroupRef[] = [{id, name}]` — join with the full group
// list to show is_default / system_kind for the effective-permission preview.
const userGroups = computed(() => {
  const all = groups.data.value?.items ?? []
  const refs = user.data.value?.groups ?? []
  const ids = refs.map(r => r.id)
  return all.filter(g => ids.includes(g.id))
})

/** Effective permissions = union of member-group permissions (§18.4/§18.5). */
const effectivePerms = computed<string[]>(() => {
  const memberGroups = userGroups.value
  if (memberGroups.some(g => g.system_kind === 'admin_scope'))
    return permStore.entries.filter(e => !e.root_only).map(e => e.id)
  return [...new Set(memberGroups.flatMap(g => g.permissions))].sort()
})

const permLabel = (id: string): string => permStore.find(id)?.label ?? id

/** §23 #5: ip_history is a dynamic PMP payload — render as JSON. */
const ipHistoryJson = computed(() => JSON.stringify(security.data.value?.ip_history ?? [], null, 2))

/** Extract selectable IPs without freezing PMP's intentionally dynamic payload. */
const knownIps = computed<string[]>(() => {
  const found = new Set<string>()
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string' && /^(?:ip|address|remote_addr)$/i.test(key)) {
      const candidate = value.includes(':') && value.includes('.') ? value.replace(/:\d+$/, '') : value
      if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate) || candidate.includes(':'))
        found.add(candidate)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, key))
      return
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey))
    }
  }
  visit(security.data.value?.ip_history ?? [])
  return [...found]
})

const reauth = useReauth()

// §23 #10: ban / unban / ban_ip / unban_ip require reauth; kick / revoke do not.
const REAUTH_ACTIONS = new Set<string>([USER_ACTION.ban, USER_ACTION.unban, USER_ACTION.banIp, USER_ACTION.unbanIp])

async function doAction(action: string, args: Record<string, unknown> = {}, reauthToken?: string) {
  validationMsg.value = ''
  try {
    await runUserAction(phiraId.value, action, args, reauthToken)
    notice.success('notice.actionCompleted', { dedupKey: `user:${phiraId.value}:${action}` })
    void security.run()
    void multiplayer.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `user:${phiraId.value}:${action}:error` })
  }
}

/** Route the click through reauth when the action is sensitive. */
function dispatchAction(action: string, args: Record<string, unknown> = {}) {
  if (REAUTH_ACTIONS.has(action)) {
    reauth.requireReauth(async (token) => {
      await doAction(action, args, token)
    })
  }
  else {
    void doAction(action, args)
  }
}

function dispatchIpAction(action: string): void {
  const ip = selectedIp.value.trim()
  if (!ip) {
    validationMsg.value = t('userDetail.ipRequired')
    return
  }
  dispatchAction(action, action === USER_ACTION.unbanIp ? { ip } : { target: ip, reason: 'admin' })
}

function auditRow(e: AuditEvent) {
  return `${formatDateTime(e.occurred_at)} · ${e.principal_type} · ${e.action} · ${e.resource_type} · ${e.result}`
}
</script>

<template>
  <div>
    <PageHeader :title="account?.username ?? t('userDetail.userTitle', { id: phiraId })" :subtitle="t('userDetail.subtitle')">
      <template #actions>
        <NuxtLink to="/users" class="text-xs text-muted hover:text-foreground">
          ← {{ t('userDetail.back') }}
        </NuxtLink>
      </template>
    </PageHeader>

    <PPTabs
      v-model="tab"
      :tabs="[
        { key: 'overview', label: t('userDetail.tabOverview') },
        { key: 'multiplayer', label: t('userDetail.tabMultiplayer') },
        { key: 'groups', label: t('userDetail.tabGroups') },
        { key: 'sessions', label: t('userDetail.tabSessions') },
        { key: 'security', label: t('userDetail.tabSecurity') },
        { key: 'audit', label: t('userDetail.tabAudit') },
      ]"
    />

    <p v-if="validationMsg" class="mt-2 text-sm text-danger" role="alert">{{ validationMsg }}</p>

    <!-- Overview -->
    <div v-if="tab === 'overview'" class="mt-4 space-y-4">
      <AsyncState :loading="user.loading.value" :error="user.error.value" :empty="false">
        <section class="rounded-lg border border-border bg-surface p-4">
          <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted">
                Phira ID
              </dt><dd class="text-foreground">
                {{ account?.phira_id }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                PPB UUID
              </dt><dd class="font-mono text-xs text-foreground">
                {{ account?.ppb_user_id }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.status') }}
              </dt><dd :class="account?.status === 'banned' ? 'text-danger' : 'text-foreground'">
                {{ userStatusLabel(t, account?.status) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.created') }}
              </dt><dd class="text-foreground">
                {{ formatDateTime(account?.created_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.lastSeen') }}
              </dt><dd class="text-foreground">
                {{ formatDateTime(account?.last_seen_at ?? undefined) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.avatar') }}
              </dt><dd class="truncate text-foreground">
                {{ account?.avatar || t('common.unknown') }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('userDetail.pmpPlayer') }}
          </h3>
          <template v-if="user.data.value?.player">
            <pre class="max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ JSON.stringify(user.data.value.player, null, 2) }}</pre>
          </template>
          <p v-else class="text-sm text-muted">
            {{ t('userDetail.playerUnavailable') }}
          </p>
        </section>
      </AsyncState>
    </div>

    <!-- Multiplayer -->
    <div v-else-if="tab === 'multiplayer'" class="mt-4">
      <AsyncState :loading="multiplayer.loading.value" :error="multiplayer.error.value" :empty="false">
        <section class="rounded-lg border border-border bg-surface p-4">
          <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.online') }}
              </dt><dd :class="multiplayer.data.value?.online ? 'text-success' : 'text-muted'">
                {{ multiplayer.data.value?.online ? t('userDetail.online') : t('userDetail.offline') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.currentRoom') }}
              </dt><dd class="font-mono text-foreground">
                {{ multiplayer.data.value?.current_room ?? t('common.unknown') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.playtime') }}
              </dt><dd class="text-foreground">
                {{ formatDuration(multiplayer.data.value?.playtime_secs ?? undefined) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.rounds') }}
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.rounds_played ?? t('common.unknown') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.replays') }}
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.replay_count ?? t('common.unknown') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                {{ t('userDetail.banState') }}
              </dt><dd :class="multiplayer.data.value?.ban_state ? 'text-danger' : 'text-foreground'">
                {{ multiplayer.data.value?.ban_state ? t('userDetail.banned') : t('userDetail.notBanned') }}
              </dd>
            </div>
          </dl>
        </section>
      </AsyncState>
    </div>

    <!-- Groups & Perms -->
    <div v-else-if="tab === 'groups'" class="mt-4 space-y-4">
      <AsyncState :loading="user.loading.value" :error="user.error.value" :empty="false">
        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('userDetail.memberGroups') }}
          </h3>
          <div class="flex flex-wrap gap-1">
            <PPBadge v-for="g in userGroups" :key="g.id" tone="accent">
              {{ g.name }}{{ g.is_default ? ` (${t('userDetail.defaultGroup')})` : '' }}
            </PPBadge>
            <span v-if="!userGroups.length" class="text-sm text-muted">{{ t('userDetail.noGroups') }}</span>
          </div>
          <p class="mt-3 text-xs text-muted">
            {{ t('userDetail.permissionsHint') }}
          </p>
          <div v-if="effectivePerms.length" class="mt-3">
            <h4 class="mb-1 text-sm font-medium text-foreground">
              {{ t('userDetail.effectivePermissions', { count: effectivePerms.length }) }}
            </h4>
            <ul class="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
              <li v-for="p in effectivePerms" :key="p" class="flex items-center gap-2">
                <span class="font-mono text-accent">{{ p }}</span>
                <span>{{ permLabel(p) }}</span>
              </li>
            </ul>
          </div>
          <p v-else class="mt-3 text-xs text-muted">
            {{ t('userDetail.noPermissions') }}
          </p>
        </section>
      </AsyncState>
    </div>

    <!-- Sessions / Identity -->
    <div v-else-if="tab === 'sessions'" class="mt-4">
      <AsyncState :loading="sessions.loading.value" :error="sessions.error.value" :empty="(sessions.data.value?.items ?? []).length === 0">
        <section class="rounded-lg border border-border bg-surface p-4">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-medium text-foreground">
              {{ t('userDetail.activeSessions') }}
            </h3>
            <PPButton size="sm" weight="dangerous" @click="doAction(USER_ACTION.revokeSessions)">
              {{ t('userDetail.revokeSessions') }}
            </PPButton>
          </div>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-border text-xs uppercase text-muted">
                <th class="px-2 py-1">
                  {{ t('userDetail.client') }}
                </th><th class="px-2 py-1">
                  {{ t('userDetail.device') }}
                </th><th class="px-2 py-1">
                  IP
                </th><th class="px-2 py-1">
                  {{ t('userDetail.createdShort') }}
                </th><th class="px-2 py-1">
                  {{ t('userDetail.status') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions.data.value?.items ?? []" :key="s.id" class="border-b border-border last:border-0">
                <td class="px-2 py-1.5">
                  {{ s.client_type }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ s.device_name || t('common.unknown') }}
                </td>
                <td class="px-2 py-1.5 font-mono text-xs text-muted">
                  {{ s.ip || t('common.unknown') }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(s.created_at) }}
                </td>
                <td class="px-2 py-1.5">
                  <span class="text-xs" :class="s.revoked_at ? 'text-danger' : 'text-success'">{{ s.revoked_at ? 'revoked' : 'active' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </AsyncState>
    </div>

    <!-- Security / IP -->
    <div v-else-if="tab === 'security'" class="mt-4 space-y-4">
      <AsyncState :loading="security.loading.value" :error="security.error.value" :empty="false">
        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('userDetail.securityActions') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <PPButton size="sm" weight="secondary" @click="dispatchAction(USER_ACTION.ban, { reason: 'admin' })">
              {{ t('userDetail.ban') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" @click="dispatchAction(USER_ACTION.unban)">
              {{ t('userDetail.unban') }}
            </PPButton>
            <PPButton size="sm" weight="secondary" @click="dispatchAction(USER_ACTION.kick)">
              {{ t('userDetail.kick') }}
            </PPButton>
            <PPButton size="sm" weight="dangerous" :disabled="!selectedIp.trim()" @click="dispatchIpAction(USER_ACTION.banIp)">
              {{ t('userDetail.ban') }} IP
            </PPButton>
            <PPButton size="sm" weight="secondary" :disabled="!selectedIp.trim()" @click="dispatchIpAction(USER_ACTION.unbanIp)">
              {{ t('userDetail.unban') }} IP
            </PPButton>
          </div>
          <label class="mt-3 block max-w-md text-xs text-muted">
            {{ t('userDetail.targetIp') }}
            <PPInput
              v-model="selectedIp"
              type="text"
              autocomplete="off"
              :placeholder="t('userDetail.ipPlaceholder')"
              class="mt-1"
            />
          </label>
          <div v-if="knownIps.length" class="mt-2 flex flex-wrap gap-1.5" :aria-label="t('userDetail.ipQuickSelect')">
            <button
              v-for="ip in knownIps"
              :key="ip"
              type="button"
              class="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted hover:border-accent hover:text-foreground"
              :class="selectedIp === ip ? 'border-accent text-accent' : ''"
              @click="selectedIp = ip"
            >
              {{ ip }}
            </button>
          </div>
          <p class="mt-3 text-xs text-muted">
            {{ t('userDetail.ipActionHint') }}
          </p>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            {{ t('userDetail.ipHistory') }}
          </h3>
          <p v-if="!(security.data.value?.ip_history ?? []).length" class="text-sm text-muted">
            {{ t('userDetail.noIpHistory') }}
          </p>
          <pre v-else class="max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ ipHistoryJson }}</pre>
          <p class="mt-2 text-xs text-muted">
            {{ t('userDetail.ipPayloadHint') }}
          </p>
        </section>
      </AsyncState>
    </div>

    <!-- Audit -->
    <div v-else-if="tab === 'audit'" class="mt-4">
      <AsyncState :loading="audit.loading.value" :error="audit.error.value" :empty="(audit.data.value?.items ?? []).length === 0">
        <ul class="space-y-1 rounded-lg border border-border bg-surface p-4 text-sm">
          <li v-for="e in audit.data.value?.items ?? []" :key="e.id" class="border-b border-border last:border-0 py-1 text-muted">
            {{ auditRow(e) }}
          </li>
        </ul>
      </AsyncState>
    </div>

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
