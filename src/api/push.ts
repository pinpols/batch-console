import { get, post } from '@/api/client'

const PUSH_API_BASE = '/api/console/push'

export const pushApi = {
  getVapidPublicKey: () => get<{ publicKey: string }>(`${PUSH_API_BASE}/vapid-public-key`),
  subscribe: (tenantId: string, subscription: PushSubscriptionJSON) =>
    post<void>(`${PUSH_API_BASE}/subscribe`, subscription, { params: { tenantId } }),
  unsubscribe: (tenantId: string, endpoint: string) =>
    post<void>(`${PUSH_API_BASE}/unsubscribe`, { endpoint }, { params: { tenantId } }),
}
