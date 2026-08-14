/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface AuditEvent {
  id: string
  occurred_at: string
  principal_type: 'root' | 'user' | string
  actor_user_id?: string
  actor_session_id?: string
  action: string
  resource_type: string
  resource_id?: string
  parameters_redacted: Record<string, unknown>
  result: 'success' | 'failure' | 'denied' | string
  error_code?: string
  request_id?: string
  command_id?: string
  ip?: string
  user_agent?: string
}

export interface AuditFilter {
  action?: string
  principal_type?: string
  result?: string
  resource_type?: string
  from?: string
  to?: string
  search?: string
}
