/** Panel account preferences with a real consumer in the current product. */
export type ChartKind = 'line' | 'bar' | 'pie'

export interface PanelPreferencesData {
  /** Per dashboard chart view type. Consumed by ChartCard. */
  per_chart_type: Record<string, ChartKind>
  /** Per dashboard chart time range. Consumed by ChartCard. */
  per_chart_range: Record<string, string>
  /** Desktop sidebar state. Consumed by AppShell. */
  sidebar: { collapsed: boolean }
  /** Experimental desktop window. Consumed by AppTopBar. */
  desktop_window: { enabled: boolean }
  /** Disables chart animation / heavy effects. Consumed by ChartCard. */
  low_performance: boolean
}

export const DEFAULT_PANEL_PREFS: PanelPreferencesData = {
  per_chart_type: {},
  per_chart_range: {},
  sidebar: { collapsed: false },
  desktop_window: { enabled: false },
  low_performance: false,
}

export function normalizePanelPreferences(raw: unknown): PanelPreferencesData {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const chartType = input.per_chart_type && typeof input.per_chart_type === 'object' ? input.per_chart_type as Record<string, unknown> : {}
  const chartRange = input.per_chart_range && typeof input.per_chart_range === 'object' ? input.per_chart_range as Record<string, unknown> : {}
  const per_chart_type: Record<string, ChartKind> = {}
  for (const [id, value] of Object.entries(chartType)) if (value === 'line' || value === 'bar' || value === 'pie') per_chart_type[id] = value
  const per_chart_range: Record<string, string> = {}
  for (const [id, value] of Object.entries(chartRange)) if (typeof value === 'string' && value.length <= 16) per_chart_range[id] = value
  const sidebar = input.sidebar && typeof input.sidebar === 'object' ? input.sidebar as Record<string, unknown> : {}
  const desktop = input.desktop_window && typeof input.desktop_window === 'object' ? input.desktop_window as Record<string, unknown> : {}
  return {
    per_chart_type,
    per_chart_range,
    sidebar: { collapsed: sidebar.collapsed === true },
    desktop_window: { enabled: desktop.enabled === true },
    low_performance: input.low_performance === true,
  }
}

export interface PanelPreferencesRecord {
  user_id: string
  namespace: 'panel'
  revision: number
  data: PanelPreferencesData
  updated_at: string
}
