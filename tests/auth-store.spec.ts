import type { ApiClient } from '~/composables/useApi'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '~/stores/auth'

// Mock the API client module before importing the store, so no Nuxt runtime
// context is required for the store's actions.
const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  fetch: vi.fn(),
  baseURL: 'https://api.example.test/api/v1',
}))

vi.mock('~/composables/useApi', () => ({
  useApi: (): ApiClient => apiMock,
  apiFetch: apiMock.fetch,
}))

describe('auth store (root login / session)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login stores a root session with must_change_password', async () => {
    apiMock.post.mockResolvedValue({ principal_type: 'root', must_change_password: true })
    apiMock.get.mockResolvedValue({ principal: 'root', csrf_token: 'tok', capabilities: [] })
    const auth = useAuthStore()
    await auth.login('secret')
    expect(apiMock.post).toHaveBeenCalledWith('/admin/auth/root/login', { password: 'secret' })
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isRoot).toBe(true)
    expect(auth.requiresPasswordChange).toBe(true)
    // Root passes any permission requirement.
    expect(auth.hasPermission(['room:kick', 'server:update'])).toBe(true)
  })

  it('changePassword clears the first-login requirement', async () => {
    apiMock.post.mockResolvedValue({ ok: true })
    const auth = useAuthStore()
    auth.authenticated = true
    auth.mustChangePassword = true
    await auth.changePassword('old', 'newpassword123')
    expect(apiMock.post).toHaveBeenCalledWith('/admin/auth/root/change-password', {
      current_password: 'old',
      new_password: 'newpassword123',
    })
    expect(auth.requiresPasswordChange).toBe(false)
  })

  it('loadSession applies the root session from /me (contract §20)', async () => {
    apiMock.get.mockResolvedValue({
      principal: 'root',
      permissions: ['*:*'],
      capabilities: [],
      csrf_token: 'tok',
    })
    const auth = useAuthStore()
    await auth.loadSession()
    expect(apiMock.get).toHaveBeenCalledWith('/me')
    expect(auth.initialized).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isRoot).toBe(true)
  })

  it('loadSession applies a normal admin session (user principal + group perms)', async () => {
    apiMock.get.mockResolvedValue({
      principal: 'user',
      user: { id: 'u1', phira_id: 123 },
      permissions: ['room:view', 'dashboard:view'],
      capabilities: ['rooms.v1'],
      csrf_token: 'tok',
    })
    const auth = useAuthStore()
    await auth.loadSession()
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isRoot).toBe(false)
    expect(auth.isNormalAdmin).toBe(true)
    expect(auth.permissions).toContain('room:view')
  })

  it('loadSession stays guest when the backend is offline', async () => {
    apiMock.get.mockRejectedValue(new Error('offline'))
    const auth = useAuthStore()
    await auth.loadSession()
    expect(auth.initialized).toBe(true)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.principalType).toBe('guest')
  })

  it('logout resets the local session even if the API fails', async () => {
    apiMock.post.mockRejectedValue(new Error('offline'))
    const auth = useAuthStore()
    auth.authenticated = true
    auth.isRoot = true
    auth.mustChangePassword = true
    await auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.principalType).toBe('guest')
    expect(auth.mustChangePassword).toBe(false)
  })

  it('hasPermission honors route-meta permission stubs', () => {
    const auth = useAuthStore()
    auth.authenticated = true
    auth.isRoot = false
    auth.permissions = ['room:view', 'dashboard:view']
    expect(auth.hasPermission([])).toBe(true)
    expect(auth.hasPermission(['room:view'])).toBe(true)
    expect(auth.hasPermission(['room:kick'])).toBe(false)
    expect(auth.hasPermission(['*:*'])).toBe(false)
  })
})
