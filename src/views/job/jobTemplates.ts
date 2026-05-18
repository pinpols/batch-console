/**
 * Job 定义模板预设(P0)— 内部场景 4 个常见 job 心智一键创建。
 *
 * 设计:
 *   - 4 个模板对应 80% 的真实需求(每日全量同步 / 增量同步 / 长任务 / 一次性脚本)
 *   - 模板提供合理默认值;用户只需改 jobCode/jobName 即可创建
 *   - 「自定义」走原创建表单(分步向导),适合 20% 复杂场景
 *   - 后续按需扩展(如分片大表),保持本文件单一职责
 */

import type { components } from '@/types/api.generated'

type CreateRequest = components['schemas']['JobDefinitionCreateRequest']

/** 模板预设的字段集合(不含 tenantId / jobCode / jobName,后两者用户必填) */
export type JobDefinitionTemplate = {
  /** 模板 key,i18n 用前缀拼: `jobDefinitionList.template.<key>.title / .desc` */
  key: 'dailyFull' | 'incremental' | 'longRunning' | 'oneShot' | 'custom'
  /** 推荐图标(@element-plus/icons-vue 组件名) */
  icon: string
  /** 推荐徽章颜色(对照 el-tag type) */
  badge: 'primary' | 'success' | 'warning' | 'info' | 'danger'
  /** 表单字段预填值。jobCode / jobName 留空让用户填 */
  defaults: Partial<CreateRequest>
}

export const JOB_TEMPLATES: JobDefinitionTemplate[] = [
  {
    key: 'dailyFull',
    icon: 'Calendar',
    badge: 'primary',
    defaults: {
      jobType: 'GENERAL',
      scheduleType: 'CRON',
      scheduleExpr: '0 0 2 * * ?',
      executionMode: 'FULL',
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      timeoutSeconds: 3600,
      priority: 5,
      enabled: true,
    },
  },
  {
    key: 'incremental',
    icon: 'Refresh',
    badge: 'success',
    defaults: {
      jobType: 'GENERAL',
      scheduleType: 'CRON',
      scheduleExpr: '0 */15 * * * ?',
      executionMode: 'INCREMENTAL',
      watermarkField: 'updated_at',
      retryPolicy: 'FIXED',
      retryMaxCount: 3,
      timeoutSeconds: 1800,
      priority: 5,
      enabled: true,
    },
  },
  {
    key: 'longRunning',
    icon: 'Timer',
    badge: 'warning',
    defaults: {
      jobType: 'GENERAL',
      scheduleType: 'CRON',
      scheduleExpr: '0 0 1 * * ?',
      executionMode: 'FULL',
      retryPolicy: 'EXPONENTIAL',
      retryMaxCount: 5,
      timeoutSeconds: 7200,
      priority: 8,
      enabled: true,
    },
  },
  {
    key: 'oneShot',
    icon: 'Lightning',
    badge: 'info',
    defaults: {
      jobType: 'GENERAL',
      scheduleType: 'MANUAL',
      triggerMode: 'MANUAL',
      executionMode: 'FULL',
      retryPolicy: 'NONE',
      retryMaxCount: 0,
      timeoutSeconds: 600,
      priority: 5,
      enabled: true,
    },
  },
  {
    key: 'custom',
    icon: 'Tools',
    badge: 'danger',
    defaults: {
      // 完全留空,走自定义路径(分步向导从空开始)
      enabled: true,
    },
  },
]
