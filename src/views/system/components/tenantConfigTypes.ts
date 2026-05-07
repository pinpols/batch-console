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
