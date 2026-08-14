import type { ConfigDescriptorsResponse, ConfigDiffResult, ConfigSnapshot, ConfigValidationResult, ConfigValue, ConfigValuesResponse } from '~/types/admin'
import { useApi } from '~/composables/useApi'
import { reauthHeaders } from '~/features/common/api'

export function fetchConfigDescriptors(): Promise<ConfigDescriptorsResponse> {
  return useApi().get('/admin/config/descriptors')
}
export function fetchConfigValues(): Promise<ConfigValuesResponse> {
  return useApi().get('/admin/config/values')
}
export function validateConfig(values: ConfigValue): Promise<ConfigValidationResult> {
  return useApi().post('/admin/config/validate', { values })
}
export function diffConfig(values: ConfigValue): Promise<ConfigDiffResult> {
  return useApi().post('/admin/config/diff', { values })
}
/** Save form values (§22 model A): PPB validates / generates YAML / snapshots. */
export function saveConfig(values: ConfigValue, reauthToken?: string): Promise<{ ok: boolean, snapshot_id?: string }> {
  return useApi().fetch('/admin/config/save', {
    method: 'POST',
    body: { values },
    headers: reauthHeaders(reauthToken),
  })
}
export function fetchConfigSnapshots(): Promise<{ items: ConfigSnapshot[] }> {
  return useApi().get('/admin/config/snapshots')
}
export function rollbackConfig(snapshotId: string, reauthToken?: string): Promise<{ ok: true }> {
  return useApi().fetch('/admin/config/rollback', { method: 'POST', body: { snapshot_id: snapshotId }, headers: reauthHeaders(reauthToken) })
}
/** Raw YAML view (read-only advanced entry, §20.3). */
export function fetchConfigRaw(): Promise<string> {
  return useApi().get('/admin/config/raw')
}
