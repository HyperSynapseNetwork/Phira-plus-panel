import type { PermissionManifestEntry } from '~/types/admin'
import { useApi } from '~/composables/useApi'

export function fetchPermissionManifest(): Promise<PermissionManifestEntry[]> {
  return useApi().get('/admin/permissions/manifest')
}
