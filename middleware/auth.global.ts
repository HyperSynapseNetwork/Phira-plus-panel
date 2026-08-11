import { defineNuxtRouteMiddleware, navigateTo } from 'nuxt/app'
import { useAuthStore } from '~/stores/auth'

/**
 * Global auth guard.
 * - Public routes opt out via `definePageMeta({ requiresAuth: false })`.
 * - First-login principals are forced through /change-password.
 * - Route-level `permissions: []` meta is enforced here (Phase A stub; later
 *   wired to the PPB Permission Manifest).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized)
    await auth.loadSession()

  if (to.meta.requiresAuth === false)
    return

  if (!auth.isAuthenticated) {
    return navigateTo({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (auth.requiresPasswordChange && to.path !== '/change-password') {
    return navigateTo('/change-password')
  }

  const required = to.meta.permissions as string[] | undefined
  if (required?.length && !auth.hasPermission(required)) {
    return navigateTo({ name: 'index', query: { denied: '1' } })
  }
})
