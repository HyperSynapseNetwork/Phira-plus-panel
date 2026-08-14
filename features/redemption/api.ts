import type { Coupon, CouponPayload } from '~/types/admin'
import type { Paginated } from '~/types/api'
import { useApi } from '~/composables/useApi'

export function fetchCoupons(params?: Record<string, unknown>): Promise<Paginated<Coupon>> {
  return useApi().get('/admin/coupons', params)
}
export function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return useApi().post('/admin/coupons/create', payload)
}
export function revokeCoupon(id: string): Promise<{ ok: true }> {
  return useApi().post(`/admin/coupons/${id}/revoke`)
}
