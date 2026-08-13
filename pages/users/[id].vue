<script setup lang="ts">
import type { AuditEvent } from '~/types/admin'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchGroups, fetchUser, fetchUserAudit, fetchUserMultiplayer, fetchUserSecurity, fetchUserSessions, runUserAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UTabs from '~/components/ui/UTabs.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { USER_ACTION } from '~/config/action-ids'
import { usePermissionsStore } from '~/stores/permissions'
import { ApiError } from '~/utils/api-error'
import { formatDateTime, formatDuration } from '~/utils/format'

definePageMeta({ permissions: ['user:view'] })

const route = useRoute()
// Route id is the Phira id (contract §22: `/admin/users/{phira_id}`).
const phiraId = computed(() => Number(route.params.id))

const tab = ref('overview')
const actionMsg = ref('')
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

const reauth = useReauth()

// §23 #10: ban / unban / ban_ip / unban_ip require reauth; kick / revoke do not.
const REAUTH_ACTIONS = new Set<string>([USER_ACTION.ban, USER_ACTION.unban, USER_ACTION.banIp, USER_ACTION.unbanIp])

async function doAction(action: string, args: Record<string, unknown> = {}, reauthToken?: string) {
  actionMsg.value = ''
  try {
    await runUserAction(phiraId.value, action, args, reauthToken)
    actionMsg.value = `操作 ${action} 已提交`
    void security.run()
    void multiplayer.run()
  }
  catch (err) {
    actionMsg.value = err instanceof ApiError ? err.message : '操作失败'
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

function auditRow(e: AuditEvent) {
  return `${formatDateTime(e.occurred_at)} · ${e.principal_type} · ${e.action} · ${e.resource_type} · ${e.result}`
}
</script>

<template>
  <div>
    <PageHeader :title="account?.username ?? `用户 ${phiraId}`" subtitle="PPB + PMP 统一管理（§18.4）">
      <template #actions>
        <NuxtLink to="/users" class="text-xs text-muted hover:text-foreground">
          ← 用户列表
        </NuxtLink>
      </template>
    </PageHeader>

    <UTabs
      v-model="tab"
      :tabs="[
        { key: 'overview', label: 'Overview' },
        { key: 'multiplayer', label: 'Multiplayer' },
        { key: 'groups', label: 'Groups & Perms' },
        { key: 'sessions', label: 'Sessions / Identity' },
        { key: 'security', label: 'Security / IP' },
        { key: 'audit', label: 'Audit' },
      ]"
    />

    <p v-if="actionMsg" class="mt-2 text-sm text-accent" role="status">
      {{ actionMsg }}
    </p>

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
                状态
              </dt><dd :class="account?.status === 'banned' ? 'text-danger' : 'text-foreground'">
                {{ account?.status }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                创建时间
              </dt><dd class="text-foreground">
                {{ formatDateTime(account?.created_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                最近活跃
              </dt><dd class="text-foreground">
                {{ formatDateTime(account?.last_seen_at ?? undefined) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Avatar
              </dt><dd class="truncate text-foreground">
                {{ account?.avatar || '—' }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            PMP player
          </h3>
          <template v-if="user.data.value?.player">
            <pre class="max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ JSON.stringify(user.data.value.player, null, 2) }}</pre>
          </template>
          <p v-else class="text-sm text-muted">
            PMP 未连接或该用户无在线数据（player 动态 payload）。
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
                在线
              </dt><dd :class="multiplayer.data.value?.online ? 'text-success' : 'text-muted'">
                {{ multiplayer.data.value?.online ? '在线' : '离线' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                当前房间
              </dt><dd class="font-mono text-foreground">
                {{ multiplayer.data.value?.current_room ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                游玩时长
              </dt><dd class="text-foreground">
                {{ formatDuration(multiplayer.data.value?.playtime_secs ?? undefined) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Rounds
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.rounds_played ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Replays
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.replay_count ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                封禁状态
              </dt><dd :class="multiplayer.data.value?.ban_state ? 'text-danger' : 'text-foreground'">
                {{ multiplayer.data.value?.ban_state ? '已封禁' : '未封禁' }}
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
            所属用户组
          </h3>
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="g in userGroups" :key="g.id" tone="accent">
              {{ g.name }}{{ g.is_default ? '（默认）' : '' }}
            </UBadge>
            <span v-if="!userGroups.length" class="text-sm text-muted">暂无用户组</span>
          </div>
          <p class="mt-3 text-xs text-muted">
            有效权限 = 所属组权限并集（admin_scope 自动映射全部非 root 权限）。成员分配请在「用户组」页面操作（§18.4/§18.5）。
          </p>
          <div v-if="effectivePerms.length" class="mt-3">
            <h4 class="mb-1 text-sm font-medium text-foreground">
              有效权限预览（{{ effectivePerms.length }}）
            </h4>
            <ul class="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
              <li v-for="p in effectivePerms" :key="p" class="flex items-center gap-2">
                <span class="font-mono text-accent">{{ p }}</span>
                <span>{{ permLabel(p) }}</span>
              </li>
            </ul>
          </div>
          <p v-else class="mt-3 text-xs text-muted">
            暂无有效权限（无组成员或权限为空）。
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
              活动会话
            </h3>
            <UButton size="sm" variant="danger" @click="doAction(USER_ACTION.revokeSessions)">
              撤销全部会话
            </UButton>
          </div>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-border text-xs uppercase text-muted">
                <th class="px-2 py-1">
                  客户端
                </th><th class="px-2 py-1">
                  设备
                </th><th class="px-2 py-1">
                  IP
                </th><th class="px-2 py-1">
                  创建
                </th><th class="px-2 py-1">
                  状态
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions.data.value?.items ?? []" :key="s.id" class="border-b border-border last:border-0">
                <td class="px-2 py-1.5">
                  {{ s.client_type }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ s.device_name || '—' }}
                </td>
                <td class="px-2 py-1.5 font-mono text-xs text-muted">
                  {{ s.ip || '—' }}
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
            账户安全操作
          </h3>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" variant="outline" @click="dispatchAction(USER_ACTION.ban, { reason: 'admin' })">
              封禁
            </UButton>
            <UButton size="sm" variant="outline" @click="dispatchAction(USER_ACTION.unban)">
              解封
            </UButton>
            <UButton size="sm" variant="outline" @click="dispatchAction(USER_ACTION.kick)">
              踢出房间
            </UButton>
            <UButton size="sm" variant="danger" @click="dispatchAction(USER_ACTION.banIp)">
              封禁 IP
            </UButton>
            <UButton size="sm" variant="outline" @click="dispatchAction(USER_ACTION.unbanIp)">
              解封 IP
            </UButton>
          </div>
          <p class="mt-3 text-xs text-muted">
            封禁原因 / IP 由 args 传入；所有操作经 Action Registry 审计（§6）。
          </p>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h3 class="mb-2 text-sm font-medium text-foreground">
            IP 历史
          </h3>
          <p v-if="!(security.data.value?.ip_history ?? []).length" class="text-sm text-muted">
            无 IP 历史记录。
          </p>
          <pre v-else class="max-h-48 overflow-auto rounded bg-surface-secondary p-2 font-mono text-xs">{{ ipHistoryJson }}</pre>
          <p class="mt-2 text-xs text-muted">
            IP history / bans 为 PMP 动态 payload（§23 #5 / §13），结构随 PMP 演进，此处原样展示。
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
