/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export interface PluginInfo {
  id: string
  name: string
  version?: string
  enabled: boolean
  description?: string
  exposed_config?: Record<string, unknown>
}
