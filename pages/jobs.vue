<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchJobs, retryJob } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { ApiError } from '~/utils/api-error'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['server:view'] })

const auth = useAuthStore()
const canRetry = computed(() => auth.hasPermission(['server:update']))

const jobs = useAsync(() => fetchJobs({ pageNum: 100 }))
const busy = ref(false)
const msg = ref('')

async function doRetry(id: string) {
  busy.value = true
  msg.value = ''
  try {
    await retryJob(id)
    msg.value = '已重新入队'
    void jobs.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '重试失败'
  }
  finally {
    busy.value = false
  }
}

const stateTone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' ? 'danger' : s === 'cancelled' ? 'neutral' : 'warning')
</script>

<template>
  <div>
    <PageHeader title="任务" subtitle="queued → running(stage) → succeeded / failed / cancelled（§9.4 / §22：无假百分比）">
      <template #actions>
        <UButton size="sm" variant="outline" @click="jobs.run()">
          刷新
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="mb-2 text-sm text-accent" role="status">
      {{ msg }}
    </p>

    <AsyncState :loading="jobs.loading.value" :error="jobs.error.value" :empty="(jobs.data.value?.items ?? []).length === 0">
      <div class="overflow-x-auto rounded-lg border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-3 py-2 font-medium">
                类型
              </th>
              <th class="px-3 py-2 font-medium">
                状态
              </th>
              <th class="px-3 py-2 font-medium">
                阶段
              </th>
              <th class="px-3 py-2 font-medium">
                创建
              </th>
              <th class="px-3 py-2 font-medium">
                完成
              </th>
              <th class="px-3 py-2 font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in jobs.data.value?.items ?? []" :key="j.id" class="border-b border-border last:border-0">
              <td class="px-3 py-2 font-medium text-foreground">
                {{ j.type }}
              </td>
              <td class="px-3 py-2">
                <UBadge :tone="stateTone(j.state)">
                  {{ j.state }}
                </UBadge>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ j.stage || '—' }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(j.created_at) }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(j.finished_at ?? undefined) }}
              </td>
              <td class="px-3 py-2">
                <UButton
                  v-if="j.state === 'failed'"
                  size="sm"
                  variant="outline"
                  :disabled="busy || !canRetry"
                  @click="doRetry(j.id)"
                >
                  重试
                </UButton>
                <span v-if="j.error" class="text-[11px] text-danger" :title="j.error">
                  失败原因
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncState>
  </div>
</template>
