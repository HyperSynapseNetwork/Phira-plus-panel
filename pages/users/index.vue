<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchUsers } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UInput from '~/components/ui/UInput.vue'
import UPagination from '~/components/ui/UPagination.vue'
import USelect from '~/components/ui/USelect.vue'
import { useAsync } from '~/composables/useAsync'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['user:view'] })

const search = ref('')
const status = ref('')
const page = ref(1)
const pageNum = 25

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
</script>

<template>
  <div>
    <PageHeader title="用户" subtitle="PPB + PMP 统一管理体验（§18.4）">
      <template #actions>
        <NuxtLink
          to="/groups"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
        >
          用户组
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UInput v-model="search" placeholder="搜索 username / Phira ID" class="w-64" />
      <USelect
        v-model="status"
        placeholder="状态"
        :options="[
          { label: '正常', value: 'active' },
          { label: '封禁', value: 'banned' },
          { label: '停用', value: 'disabled' },
        ]"
      />
    </div>

    <div class="overflow-x-auto rounded-lg border border-border bg-surface">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border text-xs uppercase text-muted">
            <th class="px-3 py-2 font-medium">
              用户
            </th>
            <th class="px-3 py-2 font-medium">
              Phira ID
            </th>
            <th class="px-3 py-2 font-medium">
              状态
            </th>
            <th class="px-3 py-2 font-medium">
              所在房间
            </th>
            <th class="px-3 py-2 font-medium">
              最近活跃
            </th>
          </tr>
        </thead>
        <tbody>
          <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value?.items ?? []).length === 0">
            <tr v-for="u in list.data.value?.items ?? []" :key="u.id" class="border-b border-border last:border-0 hover:bg-surface-secondary">
              <td class="px-3 py-2">
                <NuxtLink :to="`/users/${u.id}`" class="font-medium text-accent hover:underline">
                  {{ u.username ?? u.phira_id }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ u.phira_id }}
              </td>
              <td class="px-3 py-2">
                <span class="text-xs" :class="u.status === 'banned' ? 'text-danger' : u.status === 'active' ? 'text-success' : 'text-muted'">{{ u.status }}</span>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ u.current_room_uuid ? u.current_room_uuid.slice(0, 8) : '—' }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(u.last_seen_at) }}
              </td>
            </tr>
          </AsyncState>
        </tbody>
      </table>
    </div>

    <UPagination v-model:page="page" :page-num="pageNum" :total="list.data.value?.total ?? 0" />
  </div>
</template>
