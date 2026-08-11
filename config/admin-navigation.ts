/**
 * Permission-driven navigation stub (§18 / §8.2).
 *
 * Each item declares the minimum permission ids it needs. The sidebar filters
 * against the auth store's `hasPermission`. Phase A: only the dashboard is a
 * real route; the rest are disabled placeholders (Phase C) so no speculative
 * routes are created.
 *
 * IMPORTANT: only a handful of permission ids used by the nav live here — the
 * FULL permission manifest comes from PPB (`GET /api/v1/admin/permissions`)
 * and must never be hardcoded in the UI (design §5 / §8.2).
 */
export interface AdminNavItem {
  label: string
  to: string
  /** Required permission ids; empty = any authenticated principal. */
  permissions: string[]
  disabled?: boolean
  badge?: string
}

export interface AdminNavSection {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAVIGATION: AdminNavSection[] = [
  {
    title: '概览',
    items: [
      { label: '仪表盘', to: '/', permissions: [] },
    ],
  },
  {
    title: '管理',
    items: [
      { label: '用户', to: '/users', permissions: ['user:view'], disabled: true, badge: 'Phase C' },
      { label: '用户组', to: '/groups', permissions: ['group:view'], disabled: true, badge: 'Phase C' },
      { label: '房间', to: '/rooms', permissions: ['room:view'], disabled: true, badge: 'Phase C' },
      { label: '服务器', to: '/server', permissions: ['server:view'], disabled: true, badge: 'Phase C' },
      { label: '配置', to: '/config', permissions: ['config:view'], disabled: true, badge: 'Phase C' },
      { label: '插件', to: '/plugins', permissions: ['plugin:view'], disabled: true, badge: 'Phase C' },
    ],
  },
  {
    title: '运维',
    items: [
      { label: '日志', to: '/logs', permissions: ['logs:view'], disabled: true, badge: 'Phase C' },
      { label: '审计', to: '/audit', permissions: ['audit:view'], disabled: true, badge: 'Phase C' },
      { label: '控制台', to: '/console', permissions: ['pmp:cli'], disabled: true, badge: 'Phase C' },
      { label: '通知', to: '/notifications', permissions: ['notification:send_system'], disabled: true, badge: 'Phase C' },
    ],
  },
]
