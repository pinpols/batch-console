import type { AxiosRequestConfig } from 'axios'
import { get, post, put, del } from '@/api/client'

// 后端契约：
//  - 所有端点的 tenantId 均为 query 参数（不在 body 内）
//  - 通知渠道以 channelCode(string) 为路径标识
//  - 订阅规则以 ruleId(int64) 为路径标识
//  - 请求/响应体后端为 Map<String, Object>，此处保留 unknown

// ── Notification Channels ──

/** GET /api/console/notifications/channels?tenantId= */
export function listNotificationChannels(tenantId: string) {
  return get<unknown[]>('/api/console/notifications/channels', { tenantId })
}

/** GET /api/console/notifications/channels/{channelCode}?tenantId= */
export function getNotificationChannel(channelCode: string, tenantId: string) {
  return get<unknown>(`/api/console/notifications/channels/${encodeURIComponent(channelCode)}`, {
    tenantId,
  })
}

/** POST /api/console/notifications/channels?tenantId= */
export function createNotificationChannel(tenantId: string, body: Record<string, unknown>) {
  return post<void>('/api/console/notifications/channels', body, { params: { tenantId } })
}

/** PUT /api/console/notifications/channels/{channelCode}?tenantId= */
export function updateNotificationChannel(
  channelCode: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return put<void>(`/api/console/notifications/channels/${encodeURIComponent(channelCode)}`, body, {
    params: { tenantId },
  })
}

/** DELETE /api/console/notifications/channels/{channelCode}?tenantId= */
export function deleteNotificationChannel(channelCode: string, tenantId: string) {
  return del<void>(`/api/console/notifications/channels/${encodeURIComponent(channelCode)}`, {
    params: { tenantId },
  })
}

/** POST /api/console/notifications/channels/{channelCode}/test?tenantId= */
export function testNotificationChannel(channelCode: string, tenantId: string) {
  // _silent:测试失败由 testChannel 自己弹友好提示,抑制拦截器的后端裸报错
  //(如 "notification channel not found",无渠道时会出现)
  return post<unknown>(
    `/api/console/notifications/channels/${encodeURIComponent(channelCode)}/test`,
    undefined,
    { params: { tenantId }, _silent: true } as AxiosRequestConfig,
  )
}

// ── Notification Rules ──

/** GET /api/console/notifications/rules?tenantId= */
export function listNotificationRules(tenantId: string) {
  return get<unknown[]>('/api/console/notifications/rules', { tenantId })
}

/** GET /api/console/notifications/rules/{ruleId}?tenantId= */
export function getNotificationRule(ruleId: number, tenantId: string) {
  return get<unknown>(`/api/console/notifications/rules/${ruleId}`, { tenantId })
}

/** POST /api/console/notifications/rules?tenantId= */
export function createNotificationRule(tenantId: string, body: Record<string, unknown>) {
  return post<void>('/api/console/notifications/rules', body, { params: { tenantId } })
}

/** PUT /api/console/notifications/rules/{ruleId}?tenantId= */
export function updateNotificationRule(
  ruleId: number,
  tenantId: string,
  body: Record<string, unknown>,
) {
  return put<void>(`/api/console/notifications/rules/${ruleId}`, body, {
    params: { tenantId },
  })
}

/** DELETE /api/console/notifications/rules/{ruleId}?tenantId= */
export function deleteNotificationRule(ruleId: number, tenantId: string) {
  return del<void>(`/api/console/notifications/rules/${ruleId}`, { params: { tenantId } })
}

// ── Delivery Logs ──

/** GET /api/console/notifications/delivery-logs?tenantId=&limit= */
export function listNotificationDeliveryLogs(tenantId: string, limit = 100) {
  return get<unknown[]>('/api/console/notifications/delivery-logs', { tenantId, limit })
}
