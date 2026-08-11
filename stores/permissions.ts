import type { PermissionManifestEntry } from '~/types/admin'
import { defineStore } from 'pinia'
import { fetchPermissionManifest } from '~/api/admin'

/**
 * Permission Manifest store (contract §5, P7). The manifest comes from PPB
 * (`GET /admin/permissions`); the UI renders by group and never hardcodes the
 * full permission set. When PPB is unavailable the manifest is left empty and
 * `error` is set (pages show a graceful fallback).
 */
interface PermissionsState {
  entries: PermissionManifestEntry[]
  loaded: boolean
  loading: boolean
  error: boolean
}

export const usePermissionsStore = defineStore('permissions', {
  state: (): PermissionsState => ({
    entries: [],
    loaded: false,
    loading: false,
    error: false,
  }),

  getters: {
    groups: state => [...new Set(state.entries.map(e => e.group))].sort(),
    byGroup: state => (group: string) => state.entries.filter(e => e.group === group),
    find: state => (id: string) => state.entries.find(e => e.id === id),
    isRootOnly: state => (id: string) => state.entries.find(e => e.id === id)?.root_only ?? false,
  },

  actions: {
    async load(force = false) {
      if (this.loaded && !force)
        return
      this.loading = true
      this.error = false
      try {
        this.entries = await fetchPermissionManifest()
        this.loaded = true
      }
      catch {
        this.error = true
      }
      finally {
        this.loading = false
      }
    },
  },
})
