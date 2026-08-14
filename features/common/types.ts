/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
import type { Paginated } from '~/types/api'

export interface ActionExecuteResult {
  ok: boolean
  command_id?: string
  result?: unknown
  error?: { code: string, message: string }
}

export type PaginatedResult<T> = Paginated<T>
