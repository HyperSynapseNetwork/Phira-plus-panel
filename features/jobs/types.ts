/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface Job {
  id: string
  type: string
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string
  stage: string
  /** Contract §22: no fake percentages — null when PMP has no real progress. */
  progress?: number | null
  error: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}
