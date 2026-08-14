/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
// carries permissions[] + member_count).
// ---------------------------------------------------------------------------
export interface Group {
  id: string
  name: string
  description: string
  system_kind?: string | null
  is_default: boolean
  protected: boolean
  member_count: number
  permissions: string[]
  created_at: string
  updated_at: string
}

export interface GroupPayload {
  name: string
  description?: string
  is_default?: boolean
}
