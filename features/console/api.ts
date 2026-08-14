import type { CommandRun } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'

export function executeCommand(command: string, reauthToken?: string): Promise<CommandRun> {
  return useApi().fetch('/admin/commands/execute', {
    method: 'POST',
    body: { command },
    headers: reauthToken ? { 'X-Reauth-Token': reauthToken } : undefined,
  })
}
export function fetchCommandHistory(scope: 'personal' | 'server' = 'personal', params?: Record<string, unknown>): Promise<Paginated<CommandRun>> {
  return useApi().get('/admin/commands', { scope, ...params })
}
/** Short-lived reauth context (P11) used for elevated console commands (§17 `POST /auth/reauth`). */
export function rootReauth(password: string, risk: 'high' | 'critical' = 'high'): Promise<{ reauth_token: string }> {
  return useApi().post('/auth/phira/reauth', { password, risk })
}
