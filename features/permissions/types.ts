/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface PermissionManifestEntry {
  id: string
  group: string
  label: string
  description: string
  root_only: boolean
  risk: 'low' | 'medium' | 'high' | 'critical'
}
