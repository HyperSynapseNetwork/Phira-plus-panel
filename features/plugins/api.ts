import type { ActionExecuteResult, PluginInfo } from '~/types/admin'
import { useApi } from '~/composables/useApi'

export function fetchPlugins(): Promise<PluginInfo[]> {
  return useApi().get('/admin/plugins')
}
export function pluginAction(id: string, action: 'enable' | 'disable' | 'reload' | 'remove', args: Record<string, unknown> = {}): Promise<ActionExecuteResult> {
  return useApi().post(`/admin/plugins/${id}/${action}`, args)
}
export function callPlugin(id: string, method?: string, args: Record<string, unknown> = {}): Promise<{ ok: boolean, result?: unknown }> {
  return useApi().post(`/admin/plugins/${id}/call`, { method, args })
}
