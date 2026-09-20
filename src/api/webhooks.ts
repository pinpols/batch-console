import { get, post, put, del } from '@/api/client'
import type { components, operations } from '@/types/api.generated'

export type CreateWebhookBody = NonNullable<
  operations['createWebhook']['requestBody']
>['content']['application/json']

export type UpdateWebhookBody = NonNullable<
  operations['updateWebhook']['requestBody']
>['content']['application/json']

export type WebhookSubscription = components['schemas']['WebhookSubscriptionResponse']
export type WebhookDeliveryLog = components['schemas']['WebhookDeliveryLogResponse']

/** GET /api/console/webhooks */
export function listWebhooks(tenantId: string) {
  return get<WebhookSubscription[]>('/api/console/webhooks', { tenantId })
}

/** POST /api/console/webhooks */
export function createWebhook(tenantId: string, body: CreateWebhookBody) {
  return post<WebhookSubscription>('/api/console/webhooks', body, { params: { tenantId } })
}

/** GET /api/console/webhooks/{id} */
export function getWebhook(id: number, tenantId: string) {
  return get<WebhookSubscription>(`/api/console/webhooks/${id}`, { tenantId })
}

/** PUT /api/console/webhooks/{id} */
export function updateWebhook(id: number, tenantId: string, body: UpdateWebhookBody) {
  return put<WebhookSubscription>(`/api/console/webhooks/${id}`, body, { params: { tenantId } })
}

/** DELETE /api/console/webhooks/{id} */
export function deleteWebhook(id: number, tenantId: string) {
  return del<void>(`/api/console/webhooks/${id}`, { params: { tenantId } })
}

/** GET /api/console/webhooks/delivery-logs */
export function listWebhookDeliveryLogs(tenantId: string, subscriptionId?: number, limit?: number) {
  return get<WebhookDeliveryLog[]>('/api/console/webhooks/delivery-logs', {
    tenantId,
    ...(subscriptionId != null ? { subscriptionId } : {}),
    ...(limit != null ? { limit } : {}),
  })
}
