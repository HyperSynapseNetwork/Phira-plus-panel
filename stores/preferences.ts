import type { PanelPreferencesData, PanelPreferencesRecord } from '~/types/preferences'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import {
  DEFAULT_PANEL_PREFS,

} from '~/types/preferences'

/**
 * Panel user preferences store (namespace `panel`, §21.1 / Contract §7).
 *
 * Phase A skeleton: PPB preference sync is wired to the frozen REST namespace
 * but gracefully degrades when PPB is absent. Account prefs are kept in memory
 * only — they are NOT persisted solely to localStorage (audit §2.12).
 * A device-local cache layer can be added later as an offline fallback, with
 * the server record remaining the source of truth.
 */
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    data: { ...DEFAULT_PANEL_PREFS } as PanelPreferencesData,
    revision: 0,
    loaded: false,
    saving: false,
    loadError: false,
  }),

  getters: {
    pageSize: state => state.data.page_size,
    density: state => state.data.density,
    sidebarCollapsed: state => state.data.sidebar.collapsed,
  },

  actions: {
    async load(): Promise<void> {
      const api = useApi()
      try {
        const res = await api.get<PanelPreferencesRecord>('/me/preferences/panel')
        this.data = { ...DEFAULT_PANEL_PREFS, ...res.data }
        this.revision = res.revision
        this.loaded = true
        this.loadError = false
      }
      catch {
        // PPB preference service not reachable (Phase A placeholder).
        // Keep in-memory defaults; do NOT fall back to localStorage-only.
        this.loaded = true
        this.loadError = true
      }
    },

    /** Apply a partial update locally. Call save() to sync with PPB. */
    update(patch: Partial<PanelPreferencesData>): void {
      this.data = { ...this.data, ...patch }
    },

    /** Optimistic-concurrency save using `revision` (§7 JSONB + revision). */
    async save(): Promise<void> {
      const api = useApi()
      this.saving = true
      try {
        const res = await api.put<PanelPreferencesRecord>('/me/preferences/panel', {
          revision: this.revision,
          data: this.data,
        })
        this.revision = res.revision
      }
      finally {
        this.saving = false
      }
    },
  },
})
