import type { AdminNotificationComposer, NotificationDelivery } from '~/types/admin'
import { useApi } from '~/composables/useApi'

export function sendAdminNotification(payload: AdminNotificationComposer): Promise<{ event_id: string, recipients: number, push: Record<string, number> }> {
  return useApi().post('/admin/notifications/send', payload)
}
export function fetchNotificationDelivery(_params?: Record<string, unknown>): Promise<{ items: NotificationDelivery[] }> {
  return useApi().get('/admin/notifications/delivery')
}
