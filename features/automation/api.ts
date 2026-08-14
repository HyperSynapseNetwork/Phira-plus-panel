import type { Runbook, RunbookPayload, RunbookRun } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'

export function fetchRunbooks(params?: Record<string, unknown>): Promise<Paginated<Runbook>> {
  return useApi().get('/admin/automation/runbooks', params)
}
export function fetchRunbook(id: string): Promise<Runbook> {
  return useApi().get(`/admin/automation/runbooks/${id}`)
}
export function createRunbook(payload: RunbookPayload): Promise<Runbook> {
  return useApi().post('/admin/automation/runbooks', payload)
}
export function updateRunbook(id: string, payload: Partial<RunbookPayload>): Promise<Runbook> {
  return useApi().patch(`/admin/automation/runbooks/${id}`, payload)
}
export function deleteRunbook(id: string): Promise<{ ok: true }> {
  return useApi().delete(`/admin/automation/runbooks/${id}`)
}
export function runRunbook(id: string, args: Record<string, unknown> = {}): Promise<{ run_id: string }> {
  return useApi().post(`/admin/automation/runbooks/${id}/run`, { args })
}
export function fetchRunbookRuns(params?: Record<string, unknown>): Promise<Paginated<RunbookRun>> {
  return useApi().get('/admin/automation/runbook-runs', params)
}
/** Single run detail (live current_step / step_results / definition_snapshot). */
export function fetchRunbookRun(id: string): Promise<RunbookRun> {
  return useApi().get(`/admin/automation/runbook-runs/${id}`)
}
/** Cancel a run at the current step (only for cancellable steps). */
export function cancelRunbookRun(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/automation/runbook-runs/${id}/cancel`)
}
