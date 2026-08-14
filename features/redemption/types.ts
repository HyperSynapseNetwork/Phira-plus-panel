/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
export type CouponActionType = 'account_unlock' | 'account_role' | 'admin_alert' | 'custom_hook'

export interface Coupon {
  id: string
  code: string
  action_type: CouponActionType
  holder_mode: 'creator' | 'manual'
  status: 'active' | 'revoked' | 'redeemed' | 'expired' | string
  created_at: string
  redeemed_at?: string
  redeemed_by?: string
  note?: string
}

export interface CouponPayload {
  code?: string
  action_type: CouponActionType
  args: Record<string, unknown>
  holder_mode: 'creator' | 'manual'
  note?: string
}

export interface AdminTask {
  id: string
  source: 'coupon' | 'manual'
  type: string
  status: 'pending' | 'completed' | 'failed' | string
  payload?: Record<string, unknown>
  created_at: string
  completed_at?: string
}
