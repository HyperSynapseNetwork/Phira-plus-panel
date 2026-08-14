import type { AuditEvent, AuditFilter } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'

export function fetchAudit(params: AuditFilter & { page?: number, pageNum?: number } = {}): Promise<Paginated<AuditEvent>> {
  return useApi().get('/admin/audit', params)
}
export function exportAuditCsv(params: AuditFilter = {}): Promise<string> {
  return useApi().get('/admin/audit/export.csv', { ...params })
}
