/**
 * StatusTag 的解析配置与纯函数。
 * 拆出单独文件便于单测(StatusTag.vue 运行需要 Vue+DOM,这里只测解析逻辑)。
 */
import type { MetaOption } from '@/api/meta'
import {
  alertSeverityColor,
  alertStatusColor,
  approvalStatusColor,
  arrivalStateColor,
  batchDayStatusMeta,
  channelTypeColor,
  configStatusColor,
  deliveryStatusColor,
  executionModeColor,
  fileStatusColor,
  instanceStatusColor,
  logLevelMeta,
  logTypeColor,
  operationResultColor,
  outboxPublishStatusColor,
  partitionStatusColor,
  slaStatusMeta,
  apiKeyStatusMeta,
  tenantConfigInitActionColor,
  tenantStatusColor,
  triggerResourceTypeColor,
  triggerStatusColor,
  workerStatusColor,
  workflowDefinitionStatusColor,
  workflowRunStatusColor,
  ynStatusMeta,
  type LocalStatusMeta,
  type StatusTagType,
} from '@/constants/status'

export type StatusTagCategory =
  | 'instance'
  | 'file'
  | 'partition'
  | 'worker'
  | 'workflow'
  | 'workflowDefinition'
  | 'log'
  | 'logType'
  | 'approval'
  | 'outboxPublishStatus'
  | 'alertSeverity'
  | 'alertStatus'
  | 'batchDay'
  | 'sla'
  | 'arrival'
  | 'operationResult'
  | 'configStatus'
  | 'yn'
  | 'tenant'
  | 'trigger'
  | 'triggerResourceType'
  | 'tenantConfigInitAction'
  | 'channelType'
  | 'deliveryStatus'
  | 'apiKey'
  | 'executionMode'

/**
 * 每个分类的解析配置。
 * - `color`:value → 颜色映射(前端维护,UI 决策)
 * - `metaKeys`:依次尝试的 /meta/enums 分组 key,取到第一个就用其 label
 * - `local`:`metaKeys` 未命中 / 后端未覆盖时的本地文案兜底
 *
 * 原则:能从后端拿 label 的分类(绝大多数)都走 metaKeys;
 * 前端专属分类(yn/log/batchDay/sla)用 local。
 */
interface CategoryConfig {
  color: Record<string, StatusTagType>
  metaKeys?: readonly string[]
  local?: Record<string, LocalStatusMeta>
}

export const STATUS_TAG_CATEGORIES: Record<StatusTagCategory, CategoryConfig> = {
  instance: { color: instanceStatusColor, metaKeys: ['instanceStatus'] },
  file: { color: fileStatusColor, metaKeys: ['fileStatus'] },
  partition: { color: partitionStatusColor, metaKeys: ['partitionStatus'] },
  worker: { color: workerStatusColor, metaKeys: ['workerStatus'] },
  workflow: { color: workflowRunStatusColor, metaKeys: ['workflowRunStatus'] },
  workflowDefinition: {
    color: workflowDefinitionStatusColor,
    metaKeys: ['workflowDefinitionStatus'],
  },
  logType: { color: logTypeColor, metaKeys: ['logType'] },
  approval: { color: approvalStatusColor, metaKeys: ['approvalStatus'] },
  outboxPublishStatus: {
    color: outboxPublishStatusColor,
    metaKeys: ['outboxPublishStatus'],
  },
  alertSeverity: { color: alertSeverityColor, metaKeys: ['severity'] },
  alertStatus: { color: alertStatusColor, metaKeys: ['alertStatus'] },
  arrival: { color: arrivalStateColor, metaKeys: ['arrivalState'] },
  operationResult: { color: operationResultColor, metaKeys: ['operationResult'] },
  configStatus: { color: configStatusColor, metaKeys: ['configStatus'] },
  tenant: { color: tenantStatusColor, metaKeys: ['tenantStatus'] },
  trigger: { color: triggerStatusColor, metaKeys: ['triggerStatus'] },
  triggerResourceType: { color: triggerResourceTypeColor, metaKeys: ['triggerResourceType'] },
  tenantConfigInitAction: {
    color: tenantConfigInitActionColor,
    metaKeys: ['tenantConfigInitAction'],
  },
  channelType: { color: channelTypeColor, metaKeys: ['channelType'] },
  deliveryStatus: {
    color: deliveryStatusColor,
    metaKeys: ['webhookDeliveryStatus', 'deliveryStatus'],
  },
  apiKey: { color: {}, local: apiKeyStatusMeta },
  executionMode: { color: executionModeColor, metaKeys: ['executionMode'] },
  // /meta/enums 未提供,label 由前端维护
  log: { color: {}, local: logLevelMeta },
  yn: { color: {}, local: ynStatusMeta },
  batchDay: { color: {}, local: batchDayStatusMeta },
  sla: { color: {}, local: slaStatusMeta },
}

export interface ResolvedStatusMeta {
  label: string
  type: StatusTagType
}

/**
 * 解析 StatusTag 的 label / type。
 * label 优先级:i18n `enum.<group>.<value>` > /meta/enums > 本地 local > fallback > 原始 value > '—'
 * type 优先级:local color map > local.type > 'info'
 *
 * `translate` 由调用方注入(StatusTag.vue 注入 vue-i18n 的 `te`/`t`)。i18n key 不存在时
 * 自然回退到 BE label,迁移可分阶段:zh-CN/en-US 文案表里只填了部分 enum 也安全。
 */
export interface StatusTagTranslate {
  exists: (key: string) => boolean
  translate: (key: string) => string
}

export function resolveStatusMeta(
  value: string,
  category: StatusTagCategory,
  metaEnums: Record<string, MetaOption[]> | undefined | null,
  fallback = '',
  translate?: StatusTagTranslate,
): ResolvedStatusMeta {
  const cfg = STATUS_TAG_CATEGORIES[category]
  const localMeta = cfg.local?.[value]
  const type: StatusTagType = cfg.color[value] ?? localMeta?.type ?? 'info'

  let label: string | undefined
  if (translate && cfg.metaKeys && value) {
    for (const k of cfg.metaKeys) {
      const i18nKey = `enum.${k}.${value}`
      if (translate.exists(i18nKey)) {
        label = translate.translate(i18nKey)
        break
      }
    }
  }
  if (!label && metaEnums && cfg.metaKeys) {
    for (const k of cfg.metaKeys) {
      const group = metaEnums[k]
      if (Array.isArray(group)) {
        const hit = group.find((o) => o.value === value)
        if (hit?.label) {
          label = hit.label
          break
        }
      }
    }
  }
  if (!label) label = localMeta?.label
  if (!label) label = value || fallback || '—'

  return { label, type }
}
