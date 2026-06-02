import { get, post, put, del } from '@/api/client'
import type { operations } from '@/types/api.generated'

/**
 * R3-7 PoC:request body 类型从 OpenAPI 生成结果派生,
 * 避免 BE schema 变了 FE 手写 interface 漂移。
 *
 * Response 侧 BE 当前为 generic `CommonResponseObject`(data: unknown),
 * 没有具名 schema,仍保持 `unknown`(后续 BE 补 schema 后再回填强类型)。
 */
export type CreateWebhookBody = NonNullable<
  operations['createWebhook']['requestBody']
>['content']['application/json']

export type UpdateWebhookBody = NonNullable<
  operations['updateWebhook']['requestBody']
>['content']['application/json']

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
