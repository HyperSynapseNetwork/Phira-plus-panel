import type { PPIconName } from '~/types/ui'
/** Permission-driven, localized secondary navigation. */
export interface AdminNavItem {
  labelKey: string
  icon: PPIconName
  to: string
  permissions: string[]
  exact?: boolean
}
export interface AdminNavSection {
  titleKey: string
  items: AdminNavItem[]
}
export const ADMIN_NAVIGATION: AdminNavSection[] = [
  { titleKey: 'nav.overview', items: [{ labelKey: 'nav.dashboard', icon: 'home', to: '/', permissions: ['dashboard:view'], exact: true }] },
  { titleKey: 'nav.management', items: [
    { labelKey: 'nav.users', icon: 'users', to: '/users', permissions: ['user:view'] },
    { labelKey: 'nav.groups', icon: 'groups', to: '/groups', permissions: ['group:view'] },
    { labelKey: 'nav.rooms', icon: 'rooms', to: '/rooms', permissions: ['room:view'] },
    { labelKey: 'nav.server', icon: 'server', to: '/server', permissions: ['server:view'] },
    { labelKey: 'nav.config', icon: 'config', to: '/config', permissions: ['config:view'] },
    { labelKey: 'nav.siteConfig', icon: 'site', to: '/site-config', permissions: ['config:view'] },
    { labelKey: 'nav.plugins', icon: 'plugins', to: '/plugins', permissions: ['plugin:view'] },
  ] },
  { titleKey: 'nav.operations', items: [
    { labelKey: 'nav.logs', icon: 'logs', to: '/logs', permissions: ['logs:view'] },
    { labelKey: 'nav.console', icon: 'console', to: '/console', permissions: ['pmp:cli'] },
    { labelKey: 'nav.audit', icon: 'audit', to: '/audit', permissions: ['audit:view'] },
    { labelKey: 'nav.jobs', icon: 'jobs', to: '/jobs', permissions: ['server:view'] },
    { labelKey: 'nav.notifications', icon: 'notification', to: '/notifications', permissions: ['notification:send_system'] },
    { labelKey: 'nav.automation', icon: 'automation', to: '/automation', permissions: ['automation:view'] },
  ] },
  { titleKey: 'nav.preferences', items: [{ labelKey: 'nav.panelPreferences', icon: 'preferences', to: '/preferences', permissions: ['preference:manage'] }] },
]
