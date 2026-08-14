/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface RunbookStep {
  action: string
  with?: Record<string, unknown>
  wait?: number
}

export interface Runbook {
  id: string
  name: string
  description?: string
  definition: RunbookStep[]
  args?: Record<string, { type: string, default?: unknown }>
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface RunbookPayload {
  name: string
  description?: string
  definition: RunbookStep[]
  args?: Record<string, { type: string, default?: unknown }>
}

export interface RunbookRun {
  id: string
  runbook_id: string
  runbook_name?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string
  /** 1-based index of the step currently executing (while running). */
  current_step?: number
  step_results?: Array<{ step: number, action: string, ok: boolean, error?: string }>
  /** Definition snapshot captured at run time (§10.3), viewable in history. */
  definition_snapshot?: RunbookStep[]
  started_at?: string
  finished_at?: string
  error?: string
}
