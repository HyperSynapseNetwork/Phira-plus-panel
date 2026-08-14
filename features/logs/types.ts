/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
import type { TranslatedError } from '~/types/generated'

export interface LogEntry {
  log_id: string
  timestamp: string
  service: 'ppb' | 'pmp' | 'panel' | string
  level: 'debug' | 'info' | 'warn' | 'error' | string
  event?: string
  message: string
  error_code?: string
  request_id?: string
  command_id?: string
  room_uuid?: string
  user_id?: string
}

export interface LogFilter {
  service?: string
  level?: string
  search?: string
  from?: string
  to?: string
  cursor?: string
  /** Locate a specific stable log line (dashboard alert focus, §18.11). */
  log_id?: string
}

/** `POST /admin/logs/translate` response (§23 P-91): `{code, translated|null}`. */
export interface LogTranslation {
  code: string
  translated: TranslatedError | null
}
