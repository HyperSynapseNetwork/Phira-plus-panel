import { useApi } from '~/composables/useApi'

export interface PpfBuildConfigEnvelope { revision: number, content: Record<string, unknown> }
export function fetchPpfBuildConfig(): Promise<PpfBuildConfigEnvelope> { return useApi().get('/admin/config/ppf') }
export function savePpfBuildConfig(content: Record<string, unknown>): Promise<{ ok: true, revision: number }> {
  return useApi().fetch('/admin/config/ppf', { method: 'PUT', body: { content } })
}
