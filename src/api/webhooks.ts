import { get, post, put, del } from '@/api/client'

export interface CreateWebhookBody {
  name: string
  callbackUrl: string
  eventTypes: string[]
  secret?: string
  enabled?: boolean
}

export interface UpdateWebhookBody {
  callbackUrl: string
  eventTypes: string[]
  secret?: string
  enabled?: boolean
}

/** GET /api/console/webhooks */
export function listWebhooks(tenantId: string) {
  return get<unknown>('/api/console/webhooks', { tenantId })
}

/** POST /api/console/webhooks */
export function createWebhook(tenantId: string, body: CreateWebhookBody) {
  return post<unknown>('/api/console/webhooks', body, { params: { tenantId } })
}

/** GET /api/console/webhooks/{id} */
export function getWebhook(id: number, tenantId: string) {
  return get<unknown>(`/api/console/webhooks/${id}`, { tenantId })
}

/** PUT /api/console/webhooks/{id} */
export function updateWebhook(id: number, tenantId: string, body: UpdateWebhookBody) {
  return put<unknown>(`/api/console/webhooks/${id}`, body, { params: { tenantId } })
}

/** DELETE /api/console/webhooks/{id} */
export function deleteWebhook(id: number, tenantId: string) {
  return del<void>(`/api/console/webhooks/${id}`, { params: { tenantId } })
}

/** GET /api/console/webhooks/delivery-logs */
export function listWebhookDeliveryLogs(tenantId: string, subscriptionId?: number, limit?: number) {
  return get<unknown>('/api/console/webhooks/delivery-logs', {
    tenantId,
    ...(subscriptionId != null ? { subscriptionId } : {}),
    ...(limit != null ? { limit } : {}),
  })
}
