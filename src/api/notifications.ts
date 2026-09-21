import type { AxiosRequestConfig } from 'axios'
import { get, post, put, del } from '@/api/client'
import type { components } from '@/types/api.generated'

type NotificationChannelWire = components['schemas']['ConsoleNotificationChannelResponse']
type NotificationRuleWire = components['schemas']['ConsoleSubscriptionRuleResponse']
type NotificationDeliveryWire = components['schemas']['ConsoleNotificationDeliveryLogResponse']

function normalizeChannel(row: NotificationChannelWire) {
  return {
    ...row,
    tenantId: row.tenant_id,
    channelCode: row.channel_code,
    channelName: row.channel_name,
    channelType: row.channel_type,
    configJson: row.config_json,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeRule(row: NotificationRuleWire) {
  return {
    ...row,
    tenantId: row.tenant_id,
    ruleName: row.rule_name,
    channelCode: row.channel_code,
    eventTypes: row.event_types,
    severityFilter: row.severity_filter,
    jobCodeFilter: row.job_code_filter,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeDelivery(row: NotificationDeliveryWire) {
  return {
    ...row,
    tenantId: row.tenant_id,
    ruleId: row.rule_id,
    channelCode: row.channel_code,
    eventType: row.event_type,
    alertEventId: row.alert_event_id,
    payloadJson: row.payload_json,
    deliveryStatus: row.delivery_status,
    errorMessage: row.error_message,
    errorKey: row.error_key,
    errorArgs: row.error_args,
    createdAt: row.created_at,
  }
}

// 后端契约：
//  - 所有端点的 tenantId 均为 query 参数（不在 body 内）
//  - 通知渠道以 channelCode(string) 为路径标识
//  - 订阅规则以 ruleId(int64) 为路径标识
//  - 请求/响应体后端为 Map<String, Object>，此处保留 unknown

// ── Notification Channels ──

/** GET /api/console/notifications/channels?tenantId= */
export async function listNotificationChannels(tenantId: string) {
  const rows = await get<NotificationChannelWire[]>('/api/console/notifications/channels', {
    tenantId,
  })
  return rows.map(normalizeChannel)
}

/** GET /api/console/notifications/channels/{channelCode}?tenantId= */
export async function getNotificationChannel(channelCode: string, tenantId: string) {
  const row = await get<NotificationChannelWire>(
    `/api/console/notifications/channels/${encodeURIComponent(channelCode)}`,
    { tenantId },
  )
  return normalizeChannel(row)
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
export async function listNotificationRules(tenantId: string) {
  const rows = await get<NotificationRuleWire[]>('/api/console/notifications/rules', { tenantId })
  return rows.map(normalizeRule)
}

/** GET /api/console/notifications/rules/{ruleId}?tenantId= */
export async function getNotificationRule(ruleId: number, tenantId: string) {
  const row = await get<NotificationRuleWire>(`/api/console/notifications/rules/${ruleId}`, {
    tenantId,
  })
  return normalizeRule(row)
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
export async function listNotificationDeliveryLogs(tenantId: string, limit = 100) {
  const rows = await get<NotificationDeliveryWire[]>('/api/console/notifications/delivery-logs', {
    tenantId,
    limit,
  })
  return rows.map(normalizeDelivery)
}
