<script setup lang="ts">
import type { AuditEvent } from '~/types/admin'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchGroups, fetchUser, fetchUserAudit, fetchUserMultiplayer, fetchUserSecurity, fetchUserSessions, runUserAction } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UTabs from '~/components/ui/UTabs.vue'
import { useAsync } from '~/composables/useAsync'
import { USER_ACTION } from '~/config/action-ids'
import { ApiError } from '~/utils/api-error'
import { formatDateTime, formatDuration } from '~/utils/format'

definePageMeta({ permissions: ['user:view'] })

const route = useRoute()
const id = computed(() => String(route.params.id))

const tab = ref('overview')
const actionMsg = ref('')

const user = useAsync(() => fetchUser(id.value))
const groups = useAsync(() => fetchGroups({ pageNum: 100 }))
const multiplayer = useAsync(() => fetchUserMultiplayer(id.value), { immediate: false })
const sessions = useAsync(() => fetchUserSessions(id.value), { immediate: false })
const security = useAsync(() => fetchUserSecurity(id.value), { immediate: false })
const audit = useAsync(() => fetchUserAudit(id.value, { pageNum: 50 }), { immediate: false })

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

const userGroups = computed(() => {
  const all = groups.data.value?.items ?? []
  const ids = user.data.value?.groups ?? []
  return all.filter(g => ids.includes(g.id))
})

async function doAction(action: string, args: Record<string, unknown> = {}) {
  actionMsg.value = ''
  try {
    await runUserAction(id.value, action, args)
    actionMsg.value = `操作 ${action} 已提交`
    void security.run()
    void multiplayer.run()
  }
  catch (err) {
    actionMsg.value = err instanceof ApiError ? err.message : '操作失败'
  }
}

function auditRow(e: AuditEvent) {
  return `${formatDateTime(e.occurred_at)} · ${e.principal_type} · ${e.action} · ${e.resource_type} · ${e.result}`
}
</script>

<template>
  <div>
    <PageHeader :title="user.data.value?.username ?? `用户 ${id}`" subtitle="PPB + PMP 统一管理（§18.4）">
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
                {{ user.data.value?.phira_id }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                状态
              </dt><dd :class="user.data.value?.status === 'banned' ? 'text-danger' : 'text-foreground'">
                {{ user.data.value?.status }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                创建时间
              </dt><dd class="text-foreground">
                {{ formatDateTime(user.data.value?.created_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                最近活跃
              </dt><dd class="text-foreground">
                {{ formatDateTime(user.data.value?.last_seen_at) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                所在房间
              </dt><dd class="text-foreground">
                {{ user.data.value?.current_room_uuid ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Presence
              </dt><dd class="text-foreground">
                {{ user.data.value?.presence ?? '—' }}
              </dd>
            </div>
          </dl>
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
                当前房间
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.current_room?.name ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                访问次数
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.visit_history_count ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                游玩时长
              </dt><dd class="text-foreground">
                {{ formatDuration(multiplayer.data.value?.playtime_secs) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">
                Rounds
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.rounds_count ?? '—' }}
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
              </dt><dd class="text-foreground">
                {{ multiplayer.data.value?.ban_state ?? '—' }}
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
            有效权限 = 所属组权限并集。成员分配请在「用户组」页面操作（§18.4/§18.5）。
          </p>
        </section>
      </AsyncState>
    </div>

    <!-- Sessions / Identity -->
    <div v-else-if="tab === 'sessions'" class="mt-4">
      <AsyncState :loading="sessions.loading.value" :error="sessions.error.value" :empty="(sessions.data.value ?? []).length === 0">
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
                  创建
                </th><th class="px-2 py-1">
                  最后活跃
                </th><th class="px-2 py-1">
                  状态
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions.data.value ?? []" :key="s.id" class="border-b border-border last:border-0">
                <td class="px-2 py-1.5">
                  {{ s.client_type }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ s.device_name ?? '—' }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(s.created_at) }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(s.last_seen_at) }}
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
            <UButton size="sm" variant="outline" @click="doAction(USER_ACTION.ban, { reason: 'admin' })">
              封禁
            </UButton>
            <UButton size="sm" variant="outline" @click="doAction(USER_ACTION.unban)">
              解封
            </UButton>
            <UButton size="sm" variant="outline" @click="doAction(USER_ACTION.kick)">
              踢出房间
            </UButton>
            <UButton size="sm" variant="danger" @click="doAction(USER_ACTION.banIp)">
              封禁 IP
            </UButton>
            <UButton size="sm" variant="outline" @click="doAction(USER_ACTION.unbanIp)">
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
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-border text-xs uppercase text-muted">
                <th class="px-2 py-1">
                  IP
                </th><th class="px-2 py-1">
                  时间
                </th><th class="px-2 py-1">
                  房间
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, i) in security.data.value?.ip_history ?? []" :key="i" class="border-b border-border last:border-0">
                <td class="px-2 py-1.5 font-mono">
                  {{ h.ip }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ formatDateTime(h.seen_at) }}
                </td>
                <td class="px-2 py-1.5 text-muted">
                  {{ h.room_uuid ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
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
  </div>
</template>
