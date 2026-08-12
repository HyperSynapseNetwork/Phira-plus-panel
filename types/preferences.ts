/**
 * Panel user preferences — namespace `panel` (§21.1, Contract §7).
 * PPB persists `{user_id, namespace, revision, data, updated_at}` as JSONB +
 * revision (optimistic concurrency). Account prefs must NOT live only in
 * localStorage (audit §2.12 / contracts §7).
 */

export type ChartKind = 'line' | 'bar' | 'pie'
export type Density = 'compact' | 'comfortable' | 'spacious'

/** `panel` namespace payload. Field names follow the frozen contract. */
export interface PanelPreferencesData {
  /** Dashboard layout preference (§21.1). */
  dashboard_layout: 'grid' | 'list'
  /** Visible card ids, in order. */
  card_order: string[]
  /** Per-chart-id chart type. Key = chart id (e.g. `online_users`). */
  per_chart_type: Record<string, ChartKind>
  /** Per-chart-id time range, e.g. `24h` / `7d` / `30d`. */
  per_chart_range: Record<string, string>
  /** Per-table column visibility/order. Key = table id. */
  table_columns: Record<string, string[]>
  /** Default page size for data tables. */
  page_size: number
  /** Table density. */
  density: Density
  /** Log viewer: wrap long lines. */
  log_wrap: boolean
  /** Log viewer: auto-scroll to newest (live). */
  log_autoscroll: boolean
  /** Log viewer: which levels are shown by default. */
  log_levels: string[]
  /** Console behavior. */
  console: {
    font_size: number
    history_limit: number
  }
  /** Sidebar collapsed state (session-local default; synced to account). */
  sidebar: {
    collapsed: boolean
  }
  /** Experimental Desktop Window (§22.5) — default off; account pref. */
  desktop_window: {
    enabled: boolean
  }
  /** Low-performance mode (§22.8): disable charts animation, heavy effects. */
  low_performance: boolean
}

export const DEFAULT_PANEL_PREFS: PanelPreferencesData = {
  dashboard_layout: 'grid',
  card_order: [],
  per_chart_type: {},
  per_chart_range: {},
  table_columns: {},
  page_size: 25,
  density: 'compact',
  log_wrap: true,
  log_autoscroll: true,
  log_levels: ['error', 'warn', 'info'],
  console: {
    font_size: 13,
    history_limit: 100,
  },
  sidebar: {
    collapsed: false,
  },
  desktop_window: {
    enabled: false,
  },
  low_performance: false,
}

/** PPB preference record for the `panel` namespace. */
export interface PanelPreferencesRecord {
  user_id: string
  namespace: 'panel'
  revision: number
  data: PanelPreferencesData
  updated_at: string
}
