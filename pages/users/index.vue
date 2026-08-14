<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchUsers } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPPagination from '~/components/ui/PPPagination.vue'
import PPSelect from '~/components/ui/PPSelect.vue'
import { useAsync } from '~/composables/useAsync'
import { userStatusLabel } from '~/features/users/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['user:view'] })

const { t } = usePanelI18n()

const search = ref('')
const status = ref('')
const page = ref(1)
const pageNum = 25
const selectedId = ref<string | null>(null)

const list = useAsync(() => fetchUsers({
  search: search.value || undefined,
  status: status.value || undefined,
  page: page.value,
  pageNum,
}))

watch([search, status], () => {
  page.value = 1
  void list.run()
})

watch(page, () => {
  void list.run()
})

const selectedUser = computed(() =>
  (list.data.value?.items ?? []).find(user => user.ppb_user_id === selectedId.value) ?? null,
)
</script>

<template>
  <div>
    <PageHeader :title="t('users.title')" :subtitle="t('users.subtitle')">
      <template #actions>
        <NuxtLink
          to="/groups"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
        >
          {{ t('users.groups') }}
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <PPInput v-model="search" :placeholder="t('users.search')" class="w-64" />
      <PPSelect
        v-model="status"
        :placeholder="t('users.status')"
        :options="[
          { label: t('users.active'), value: 'active' },
          { label: t('users.banned'), value: 'banned' },
          { label: t('users.disabled'), value: 'disabled' },
        ]"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <PPSurface as="div" class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border text-xs uppercase text-muted">
            <th class="px-3 py-2 font-medium">
              {{ t('users.user') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('users.phiraId') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('users.ppbUuid') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('users.status') }}
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('users.lastSeen') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value?.items ?? []).length === 0">
            <tr
              v-for="u in list.data.value?.items ?? []"
              :key="u.ppb_user_id"
              class="cursor-pointer border-b border-border last:border-0 hover:bg-surface-secondary"
              :class="selectedId === u.ppb_user_id ? 'bg-accent-soft' : ''"
              @click="selectedId = u.ppb_user_id"
            >
              <td class="px-3 py-2">
                <NuxtLink :to="`/users/${u.phira_id}`" class="font-medium text-accent hover:underline" @click.stop>
                  {{ u.username }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ u.phira_id }}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-muted">
                {{ u.ppb_user_id.slice(0, 8) }}
              </td>
              <td class="px-3 py-2">
                <span class="text-xs" :class="u.status === 'banned' ? 'text-danger' : u.status === 'active' ? 'text-success' : 'text-muted'">{{ userStatusLabel(t, u.status) }}</span>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(u.last_seen_at ?? undefined) }}
              </td>
            </tr>
          </AsyncState>
        </tbody>
      </table>
      </PPSurface>

      <PPSurface as="aside" class="p-4 lg:sticky lg:top-4 lg:self-start">
        <template v-if="selectedUser">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">{{ t('users.inspector') }}</p>
          <h2 class="mt-2 text-lg font-semibold text-foreground">{{ selectedUser.username }}</h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div><dt class="text-xs text-muted">{{ t('users.phiraId') }}</dt><dd class="mt-0.5 font-mono text-foreground">{{ selectedUser.phira_id }}</dd></div>
            <div><dt class="text-xs text-muted">{{ t('users.ppbUuid') }}</dt><dd class="mt-0.5 break-all font-mono text-xs text-foreground">{{ selectedUser.ppb_user_id }}</dd></div>
            <div><dt class="text-xs text-muted">{{ t('users.status') }}</dt><dd class="mt-0.5 text-foreground">{{ userStatusLabel(t, selectedUser.status) }}</dd></div>
            <div><dt class="text-xs text-muted">{{ t('users.lastSeen') }}</dt><dd class="mt-0.5 text-foreground">{{ formatDateTime(selectedUser.last_seen_at ?? undefined) }}</dd></div>
          </dl>
          <NuxtLink :to="`/users/${selectedUser.phira_id}`" class="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
            {{ t('users.openDetail') }}
          </NuxtLink>
        </template>
        <p v-else class="text-sm text-muted">{{ t('users.selectHint') }}</p>
      </PPSurface>
    </div>

    <PPPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />
  </div>
</template>
