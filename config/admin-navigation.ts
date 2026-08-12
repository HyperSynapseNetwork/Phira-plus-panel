/**
 * Permission-driven navigation (§18 / §8.2).
 *
 * Each item declares the minimum permission ids it needs; the sidebar filters
 * against the auth store's `hasPermission`. The ids here are a small set
 * consistent with the integration-required set (contract §5, P7) and the
 * documented admin pages (`logs:view`, `automation:view`, `server:view`,
 * `coupon:view`, …) — the PPB Permission Manifest is always the authority and
 * the full set is never hardcoded.
 */
export interface AdminNavItem {
  label: string
  to: string
  /** Required permission ids; empty = any authenticated principal. */
  permissions: string[]
  exact?: boolean
}

export interface AdminNavSection {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAVIGATION: AdminNavSection[] = [
  {
    title: '概览',
    items: [
      { label: '仪表盘', to: '/', permissions: ['dashboard:view'], exact: true },
    ],
  },
  {
    title: '管理',
    items: [
      { label: '用户', to: '/users', permissions: ['user:view'] },
      { label: '用户组', to: '/groups', permissions: ['group:view'] },
      { label: '房间', to: '/rooms', permissions: ['room:view'] },
      { label: '服务器', to: '/server', permissions: ['server:view'] },
      { label: '配置', to: '/config', permissions: ['config:view'] },
      { label: '插件', to: '/plugins', permissions: ['plugin:view'] },
    ],
  },
  {
    title: '运维',
    items: [
      { label: '日志', to: '/logs', permissions: ['logs:view'] },
      { label: '控制台', to: '/console', permissions: ['pmp:cli'] },
      { label: '审计', to: '/audit', permissions: ['audit:view'] },
      { label: '任务', to: '/jobs', permissions: ['server:view'] },
      { label: '通知', to: '/notifications', permissions: ['notification:send_system'] },
      { label: '优惠券', to: '/coupons', permissions: ['coupon:view'] },
      { label: '自动化', to: '/automation', permissions: ['automation:view'] },
    ],
  },
  {
    title: '偏好',
    items: [
      { label: '面板偏好', to: '/preferences', permissions: ['preference:manage'] },
    ],
  },
]
