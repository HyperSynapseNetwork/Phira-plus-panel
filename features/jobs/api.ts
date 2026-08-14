import type { AdminTask, Job } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'
import { reauthHeaders } from '~/features/common/api'

export function fetchJobs(params?: Record<string, unknown>): Promise<Paginated<Job>> {
  return useApi().get('/admin/jobs', params)
}
/** `GET /admin/jobs/{job_id}` — single job detail (§9.4). */
export function fetchJob(id: string): Promise<Job> {
  return useApi().get(`/admin/jobs/${id}`)
}
/**
 * `POST /admin/jobs` — start a long job (`pmp.update.check` / `pmp.update.apply`
 * / `ppf.build` / `backup`). `pmp.update.apply` requires critical reauth (§23 #10).
 * Response is `{ job }`.
 */
export function createJob(type: string, args: Record<string, unknown> = {}, reauthToken?: string): Promise<{ job: Job }> {
  return useApi().fetch('/admin/jobs', { method: 'POST', body: { type, args }, headers: reauthHeaders(reauthToken) })
}
/** `POST /admin/jobs/{job_id}/cancel` — cancel a running/queued job. */
export function cancelJob(id: string): Promise<{ cancelled: string }> {
  return useApi().post(`/admin/jobs/${id}/cancel`)
}
/** Retry a failed/cancelled job (§9.4 / §17 `POST /jobs/{job_id}/retry`). */
export function retryJob(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/jobs/${id}/retry`)
}
export function fetchAdminTasks(params?: Record<string, unknown>): Promise<Paginated<AdminTask>> {
  return useApi().get('/admin/jobs/tasks', params)
}
export function completeAdminTask(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/jobs/tasks/${id}/complete`)
}
