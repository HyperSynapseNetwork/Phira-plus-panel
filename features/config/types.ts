/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
// values; PPB validates / generates YAML / saves.
// ---------------------------------------------------------------------------
export interface ConfigFieldDescriptor {
  path: string
  label: string
  description: string
  order: number
  permission: string
  /** hot | restart | rebuild */
  reload_semantics: string
  risk: string
  sensitive: boolean
  /** Wire value type: string | number | boolean. */
  type: string
  widget: string
  min?: number | null
  max?: number | null
  default?: unknown
}

export interface ConfigFieldGroup {
  key: string
  label: string
  fields: ConfigFieldDescriptor[]
}

/** `GET /config/descriptors` → `{version, groups}` (§22). */
export interface ConfigDescriptorsResponse {
  version: number
  groups: ConfigFieldGroup[]
}

export interface ConfigValue {
  [path: string]: unknown
}

/** `GET /config/values` → `{version, values}` (§22). */
export interface ConfigValuesResponse {
  version: number
  values: ConfigValue
}

export type ConfigValidationIssueCode = 'VALUES_MUST_BE_OBJECT' | 'EXPECTED_TYPE'
export interface ConfigValidationIssue {
  path: string
  code: ConfigValidationIssueCode
  params?: Record<string, string | number>
  /** Debug/legacy fallback only. Product UI must not render this string. */
  message?: string | null
}
export interface ConfigValidationResult {
  ok: boolean
  errors: ConfigValidationIssue[]
}

/** `POST /config/diff` → `{changes: [{path, old, new}]}` (§22). */
export interface ConfigDiffResult {
  changes: Array<{ path: string, old: unknown, new: unknown }>
}

export interface ConfigSnapshot {
  id: string
  note: string
  content: string
  created_at: string
  created_by?: string | null
  restored_at?: string | null
  scope: string
}
