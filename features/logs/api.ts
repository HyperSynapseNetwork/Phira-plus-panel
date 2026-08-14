import type { LogEntry, LogFilter, LogTranslation } from './types'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'

export function fetchLogs(params: LogFilter & { page?: number, pageNum?: number } = {}): Promise<Paginated<LogEntry>> {
  return useApi().get('/admin/logs', params)
}
/** §23 P-91: request `{code}`; response `{code, translated: {...} | null}`. */
export function translateLog(code: string): Promise<LogTranslation> {
  return useApi().post('/admin/logs/translate', { code })
}
