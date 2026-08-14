/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface CommandRun {
  command_id: string
  command: string
  action?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string
  output?: string
  error?: string
  executed_at: string
  principal?: string
  scope: 'personal' | 'server'
}
