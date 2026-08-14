<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchJobs, retryJob } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPButton from '~/components/ui/PPButton.vue'
import { useAsync } from '~/composables/useAsync'
import { useAuthStore } from '~/stores/auth'
import { jobStageLabel, jobStateLabel, jobTypeLabel } from '~/features/jobs/labels'
import { formatDateTime } from '~/utils/format'

definePageMeta({ permissions: ['server:view'] })

const { t } = usePanelI18n()

const auth = useAuthStore()
const canRetry = computed(() => auth.hasPermission(['server:update']))

const jobs = useAsync(() => fetchJobs({ pageNum: 100 }))
const busy = ref(false)
const notice = useNotice()

async function doRetry(id: string) {
  busy.value = true
  try {
    await retryJob(id)
    notice.success('notice.retried', { dedupKey: `job:${id}:retry` })
    void jobs.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: `job:${id}:retry:error` })
  }
  finally {
    busy.value = false
  }
}

const stateTone = (s: string) => (s === 'succeeded' ? 'success' : s === 'failed' ? 'error' : s === 'cancelled' ? 'neutral' : s === 'running' ? 'live' : 'warning')
</script>

<template>
  <div>
    <PageHeader :title="t('jobsPage.title')" :subtitle="t('jobsPage.subtitle')">
      <template #actions>
        <PPButton size="sm" weight="secondary" @click="jobs.run()">
          {{ t('jobsPage.refresh') }}
        </PPButton>
      </template>
    </PageHeader>

    <AsyncState :loading="jobs.loading.value" :error="jobs.error.value" :empty="(jobs.data.value?.items ?? []).length === 0">
      <div class="overflow-x-auto rounded-lg border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.type') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.state') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.stage') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.created') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.finished') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('jobsPage.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in jobs.data.value?.items ?? []" :key="j.id" class="border-b border-border last:border-0">
              <td class="px-3 py-2 font-medium text-foreground">
                {{ jobTypeLabel(t, j.type) }}
              </td>
              <td class="px-3 py-2">
                <PPStatus :tone="stateTone(j.state)">
                  {{ jobStateLabel(t, j.state) }}
                </PPStatus>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ jobStageLabel(t, j.stage) }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(j.created_at) }}
              </td>
              <td class="px-3 py-2 text-muted">
                {{ formatDateTime(j.finished_at ?? undefined) }}
              </td>
              <td class="px-3 py-2">
                <PPButton
                  v-if="j.state === 'failed'"
                  size="sm"
                  weight="secondary"
                  :disabled="busy || !canRetry"
                  @click="doRetry(j.id)"
                >
                  {{ t('jobsPage.retry') }}
                </PPButton>
                <span v-if="j.error" class="text-[11px] text-danger" :title="j.error">
                  {{ t('jobsPage.failureReason') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncState>
  </div>
</template>
