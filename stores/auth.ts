import type { MeSession } from '~/types/api'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { clearCsrfToken, setCsrfToken } from '~/utils/csrf'

export type PrincipalType = 'guest' | 'root' | 'user'

/**
 * Contract §20: `GET /api/v1/me` is the ONLY identity interface. Root is a
 * separate emergency/local principal (user_id = NULL); normal admins are
 * ordinary PPB Users (Phira login + group membership) whose permissions are
 * resolved at runtime by PPB.
 */

/** Root password login (design §6.8, contract §15 P2) — unchanged. */
export interface RootLoginRequest {
  password: string
}

export interface RootLoginResponse {
  principal_type: 'root'
  /** First-login default random password must be changed (design §6.8). */
  must_change_password: boolean
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  ok: true
}

export interface AuthState {
  principalType: PrincipalType
  authenticated: boolean
  mustChangePassword: boolean
  isRoot: boolean
  /** Effective permission ids for the current principal (empty for root). */
  permissions: string[]
  /** PPB capabilities from `/me` (feature detection, contract §9). */
  capabilities: string[]
  /** Session has been probed at least once (even when offline). */
  initialized: boolean
  loading: boolean
}

export function applySession(state: AuthState, session: MeSession): void {
  state.authenticated = session.principal === 'root' || session.principal === 'user'
  state.principalType = session.principal === 'guest' ? 'guest' : session.principal
  state.isRoot = session.principal === 'root'
  state.mustChangePassword = session.must_change_password ?? false
  state.permissions = session.permissions ?? []
  state.capabilities = session.capabilities ?? []
  setCsrfToken(session.csrf_token ?? null)
}

export function resetSession(state: AuthState): void {
  state.authenticated = false
  state.principalType = 'guest'
  state.isRoot = false
  state.mustChangePassword = false
  state.permissions = []
  state.capabilities = []
  clearCsrfToken()
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    principalType: 'guest',
    authenticated: false,
    mustChangePassword: false,
    isRoot: false,
    permissions: [],
    capabilities: [],
    initialized: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: state => state.authenticated,
    requiresPasswordChange: state => state.authenticated && state.mustChangePassword,
    /** True for normal (non-Root) admin principals. */
    isNormalAdmin: state => state.authenticated && state.principalType === 'user',
  },

  actions: {
    /**
     * Probe the session from `GET /me` on app start (session plugin + auth
     * middleware). Session cookie is HttpOnly; the frontend never holds the
     * JWT (design §6.4). The response also carries the CSRF token (§20/§21).
     */
    async loadSession(): Promise<void> {
      if (this.initialized)
        return
      const api = useApi()
      try {
        const session = await api.get<MeSession>('/me')
        applySession(this, session)
      }
      catch {
        // Not authenticated or backend offline — stay guest.
        resetSession(this)
      }
      finally {
        this.initialized = true
      }
    },

    /** Root password login (emergency/local principal, design §6.8). */
    async login(password: string): Promise<void> {
      const api = useApi()
      this.loading = true
      try {
        const res = await api.post<RootLoginResponse>('/admin/auth/root/login', { password } satisfies RootLoginRequest)
        this.authenticated = true
        this.principalType = 'root'
        this.isRoot = true
        this.mustChangePassword = res.must_change_password ?? false
        this.permissions = ['*:*']
        this.initialized = true
        // Re-probe /me so the CSRF token for the new session is captured.
        try {
          const session = await api.get<MeSession>('/me')
          setCsrfToken(session.csrf_token ?? null)
          this.capabilities = session.capabilities ?? []
        }
        catch {
          // Best-effort; writes will refresh via the CSRF path.
        }
      }
      finally {
        this.loading = false
      }
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      const api = useApi()
      await api.post<ChangePasswordResponse>('/admin/auth/root/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      } satisfies ChangePasswordRequest)
      this.mustChangePassword = false
    },

    async logout(): Promise<void> {
      const api = useApi()
      try {
        await api.post('/auth/logout')
      }
      catch {
        // Best-effort: clear local session regardless of network state.
      }
      resetSession(this)
      this.initialized = true
    },

    /**
     * Permission gate. Empty list ⇒ any authenticated principal. Root (`*:*`)
     * passes everything. Normal admins are matched against the runtime-resolved
     * `/me` permissions (contract §20). The full set is never hardcoded here.
     */
    hasPermission(required: string[]): boolean {
      if (!required || required.length === 0)
        return true
      if (this.isRoot)
        return true
      return required.every(p => this.permissions.includes(p) || this.permissions.includes('*:*'))
    },
  },
})
