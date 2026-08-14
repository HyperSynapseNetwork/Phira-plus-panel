export function reauthHeaders(token?: string): Record<string, string> | undefined {
  return token ? { 'X-Reauth-Token': token } : undefined
}
