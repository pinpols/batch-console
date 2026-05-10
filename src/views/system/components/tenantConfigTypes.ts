import type { ConfigType } from '@/api/ops'

/** 10 个租户级配置域;Init / Copy 两个对话框共用。 */
export const ALL_CONFIG_TYPES: readonly ConfigType[] = [
  'JOB_DEFINITION',
  'WORKFLOW_DEFINITION',
  'PIPELINE_DEFINITION',
  'FILE_CHANNEL',
  'FILE_TEMPLATE',
  'RESOURCE_QUEUE',
  'BATCH_WINDOW',
  'BUSINESS_CALENDAR',
  'QUOTA_POLICY',
  'ALERT_ROUTING',
] as const

/**
 * 系统/内置租户 — 作为"复制源"或"批量新建初始化源"时不应出现在下拉里。
 *
 * - `system`:Built-in system management tenant,系统管理用,不该当业务模板
 * - `default-tenant`:从 console_user_account 迁移过来的历史痕迹,业务上无意义
 *
 * `default` **不在此列**:它是 BE 内置的 "Template tenant for new tenant config",
 * 设计目的就是当复制源/初始化模板,会作为下拉里的"推荐项"突出显示。
 *
 * BE 端目前没强制(TenantConfigCopyRequest 只 @NotBlank sourceTenantId),
 * 这里 FE 是 UX 拦截。后续 BE 应在 ConsoleTenantConfigInitController.tenantCopy
 * 加白名单/拒绝 reserved tenant 兜底。
 */
export const RESERVED_TENANT_IDS: readonly string[] = ['system', 'default-tenant']

export function isReservedTenant(tenantId: string): boolean {
  return RESERVED_TENANT_IDS.includes(tenantId)
}

/** 推荐作为初始化/复制模板的内置租户 id;在下拉里加"推荐"标签 */
export const TEMPLATE_TENANT_ID = 'default'

export function isTemplateTenant(tenantId: string): boolean {
  return tenantId === TEMPLATE_TENANT_ID
}
