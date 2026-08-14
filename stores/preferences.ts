import type { PanelPreferencesData, PanelPreferencesRecord } from '~/types/preferences'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { DEFAULT_PANEL_PREFS, normalizePanelPreferences } from '~/types/preferences'

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    data: normalizePanelPreferences(DEFAULT_PANEL_PREFS),
    revision: 0,
    loaded: false,
    saving: false,
    loadError: false,
  }),
  getters: {
    sidebarCollapsed: state => state.data.sidebar.collapsed,
  },
  actions: {
    async load(): Promise<void> {
      try {
        const res = await useApi().get<PanelPreferencesRecord>('/me/preferences/panel')
        this.data = normalizePanelPreferences(res.data)
        this.revision = res.revision
        this.loadError = false
      }
      catch {
        this.data = normalizePanelPreferences(this.data)
        this.loadError = true
      }
      finally { this.loaded = true }
    },
    update(patch: Partial<PanelPreferencesData>): void { this.data = normalizePanelPreferences({ ...this.data, ...patch }) },
    async save(): Promise<void> {
      this.saving = true
      try {
        const res = await useApi().put<PanelPreferencesRecord>('/me/preferences/panel', { revision: this.revision, data: normalizePanelPreferences(this.data) })
        this.data = normalizePanelPreferences(res.data)
        this.revision = res.revision
      }
      finally { this.saving = false }
    },
  },
})
