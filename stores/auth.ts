import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'

export type PrincipalType = 'guest' | 'root' | 'user'

/**
 * PROPOSED contract — pending freeze (see docs/PHASE_A_PLAN.md).
 * Design §6.8: Root is a local principal (user_id = NULL), password-only login.
 */
export interface RootLoginRequest {
  password: string
}

export interface RootLoginResponse {
  principal_type: 'root'
  /** First-login default random password must be changed (design §6.8). */
  must_change_password: boolean
}

export interface RootSessionResponse {
  authenticated: boolean
  principal_type: 'root'
  must_change_password: boolean
  /** Root has `*:*`; server may return it as `['*:*']`. */
  permissions: string[]
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
  /** Session has been probed at least once (even when offline). */
  initialized: boolean
  loading: boolean
}

export function applySession(state: AuthState, session: RootSessionResponse): void {
  state.authenticated = session.authenticated
  state.principalType = session.principal_type
  state.isRoot = session.principal_type === 'root'
  state.mustChangePassword = session.must_change_password
  state.permissions = session.permissions ?? []
}

export function resetSession(state: AuthState): void {
  state.authenticated = false
  state.principalType = 'guest'
  state.isRoot = false
  state.mustChangePassword = false
  state.permissions = []
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    principalType: 'guest',
    authenticated: false,
    mustChangePassword: false,
    isRoot: false,
    permissions: [],
    initialized: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: state => state.authenticated,
    requiresPasswordChange: state => state.authenticated && state.mustChangePassword,
  },

  actions: {
    /**
     * Probe the PPB session on app start (called by the session plugin and
     * by the auth middleware as a guard). Session cookie is HttpOnly; the
     * frontend never holds the JWT (design §6.4). Idempotent.
     */
    async loadSession(): Promise<void> {
      if (this.initialized)
        return
      const api = useApi()
      try {
        const session = await api.get<RootSessionResponse>('/admin/auth/root/session')
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

    async login(password: string): Promise<void> {
      const api = useApi()
      this.loading = true
      try {
        const res = await api.post<RootLoginResponse>('/admin/auth/root/login', { password } satisfies RootLoginRequest)
        this.authenticated = true
        this.principalType = res.principal_type ?? 'root'
        this.isRoot = res.principal_type === 'root'
        this.mustChangePassword = res.must_change_password ?? false
        this.permissions = ['*:*']
        this.initialized = true
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
     * Permission gate (Phase A stub). Empty list ⇒ any authenticated
     * principal. Root (`*:*`) passes everything. Later wired to the
     * PPB Permission Manifest — the full set is never hardcoded here.
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
