/** Panel domain types. Public wire overlap comes from frozen generated OpenAPI. */
/**
 * Notification action dispatcher whitelist (§22): the ONLY action values a
 * notification payload may carry. Backend executes join_room/friend_accept/
 * friend_reject; the rest are pure deep-links the frontend navigates to.
 * Never an arbitrary Action Registry ID.
 */
export type NotificationAction
  = | 'join_room'
    | 'friend_accept'
    | 'friend_reject'
    | 'open_chart'
    | 'open_replay'
    | 'open_room'
    | 'open_user'
    | 'open_profile'

export interface AdminNotificationComposer {
  type: string
  priority: 'low' | 'normal' | 'high'
  title: string
  body: string
  target: {
    all?: boolean
    group_ids?: string[]
    user_ids?: string[]
  }
  actions?: Array<{
    label: string
    action: NotificationAction
    data: {
      room_id?: string
      chart_id?: number
      phira_id?: number
      round_uuid?: string
      friend_request_id?: string
    }
    danger?: boolean
  }>
  dedup_key?: string
}

export interface NotificationDelivery {
  id: string
  type: string
  title: string
  target_summary: string
  status: 'queued' | 'delivered' | 'failed' | string
  delivered_count?: number
  failed_count?: number
  sent_at?: string
}
