/**
 * Hardcoded / rules-based log translator (§19.2). PPB may provide a richer
 * translation endpoint (`POST /admin/logs/translate`); this local registry is
 * the offline fallback. Raw log text is always shown alongside.
 */
export interface LocalLogTranslation {
  title: string
  explanation: string
  module?: string
  severity?: string
  suggestion?: string
}

const REGISTRY: Record<string, LocalLogTranslation> = {
  PMP_OPENUDS_TIMEOUT: {
    title: 'PMP 命令响应超时',
    explanation: 'PPB 已发送命令，但 PMP 未在预算时间内返回。',
    module: 'OpenUDS',
    severity: 'warning',
    suggestion: '检查 PMP 是否卡死，必要时重启 PMP。',
  },
  OPENUDS_DISCONNECT: {
    title: 'OpenUDS 连接断开',
    explanation: '与 PMP 的 Unix Socket 连接断开，将尝试自动重连。',
    module: 'OpenUDS',
    severity: 'warning',
  },
  PHIRA_API_TIMEOUT: {
    title: 'Phira API 超时',
    explanation: '上游 Phira API 响应超时。',
    module: 'Phira',
    severity: 'warning',
    suggestion: 'Phira API 可能不稳定，已按退避策略重试。',
  },
  PHIRA_CREDENTIAL_EXPIRED: {
    title: 'Phira 凭据过期',
    explanation: '用户 Phira refresh token 失效，需要重新认证（phira_reauth_required）。',
    module: 'Auth',
    severity: 'error',
  },
  DB_CONNECTION_ERROR: {
    title: '数据库连接错误',
    explanation: 'PPB 无法连接 PostgreSQL。',
    module: 'PPB',
    severity: 'error',
    suggestion: '检查数据库地址/凭据与服务状态。',
  },
  ROOM_FORCE_MOVE_FAILED: {
    title: '房间转移失败',
    explanation: 'force_move 未能在目标房间放置用户。',
    module: 'Rooms',
    severity: 'warning',
  },
  PLUGIN_EXECUTION_ERROR: {
    title: '插件执行错误',
    explanation: '插件调用抛出异常。',
    module: 'Plugins',
    severity: 'warning',
  },
}

export function localTranslate(input: { error_code?: string, message?: string }): LocalLogTranslation | null {
  if (input.error_code && REGISTRY[input.error_code])
    return REGISTRY[input.error_code]
  if (input.message) {
    const m = input.message.toLowerCase()
    if (m.includes('timeout'))
      return { title: '超时', explanation: '操作或请求超时。', module: 'Unknown', severity: 'warning' }
    if (m.includes('connection refused'))
      return { title: '连接被拒绝', explanation: '目标服务未监听或不可达。', module: 'Network', severity: 'error' }
    if (m.includes('permission'))
      return { title: '权限不足', explanation: '操作被权限系统拒绝。', module: 'Auth', severity: 'error' }
  }
  return null
}
