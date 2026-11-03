import type { ConsoleOpsSummaryResponse } from '@/types/console-api'

export type AttentionSummary = Pick<
  ConsoleOpsSummaryResponse,
  | 'pendingApprovals'
  | 'openAlerts'
  | 'criticalAlerts'
  | 'failedJobs'
  | 'slaBreaches'
  | 'drainingWorkers'
  | 'offlineWorkers'
  | 'outboxRetryBacklog'
  | 'outboxDeliveryFailures'
>

export type AttentionKey =
  | 'criticalAlerts'
  | 'failedJobs'
  | 'offlineWorkers'
  | 'outboxDeliveryFailures'
  | 'slaBreaches'
  | 'pendingApprovals'
  | 'openAlerts'
  | 'drainingWorkers'
  | 'outboxRetryBacklog'

export type AttentionAction = { kind: 'route'; path: string } | { kind: 'failedJobs' }

export interface AttentionItem {
  key: AttentionKey
  tone: 'danger' | 'warning'
  count: number
  action: AttentionAction
}

interface AttentionRule {
  key: AttentionKey
  tone: AttentionItem['tone']
  count: (summary: AttentionSummary) => number
  action: AttentionAction
}

/** 顺序即优先级：先失败与不可用，再待决策与积压。跳转目标与指标卡保持一致。 */
const RULES: readonly AttentionRule[] = [
  {
    key: 'criticalAlerts',
    tone: 'danger',
    count: (s) => s.criticalAlerts,
    action: { kind: 'route', path: '/observability/alerts?severity=CRITICAL&status=OPEN' },
  },
  { key: 'failedJobs', tone: 'danger', count: (s) => s.failedJobs, action: { kind: 'failedJobs' } },
  {
    key: 'offlineWorkers',
    tone: 'danger',
    count: (s) => s.offlineWorkers,
    action: { kind: 'route', path: '/workers/management?status=OFFLINE,DECOMMISSIONED' },
  },
  {
    key: 'outboxDeliveryFailures',
    tone: 'danger',
    count: (s) => s.outboxDeliveryFailures,
    action: { kind: 'route', path: '/observability/outbox?tab=delivery&status=FAILED' },
  },
  {
    key: 'slaBreaches',
    tone: 'warning',
    count: (s) => s.slaBreaches,
    action: { kind: 'route', path: '/monitor/job-instances?slaBreached=1&range=all' },
  },
  {
    key: 'pendingApprovals',
    tone: 'warning',
    count: (s) => s.pendingApprovals,
    action: { kind: 'route', path: '/approvals?status=PENDING' },
  },
  {
    key: 'openAlerts',
    tone: 'warning',
    // 严重告警已单独成项，这里只计其余未处理告警
    count: (s) => Math.max(0, s.openAlerts - s.criticalAlerts),
    action: { kind: 'route', path: '/observability/alerts?status=OPEN' },
  },
  {
    key: 'drainingWorkers',
    tone: 'warning',
    count: (s) => s.drainingWorkers,
    action: { kind: 'route', path: '/workers/management?status=DRAINING' },
  },
  {
    key: 'outboxRetryBacklog',
    tone: 'warning',
    count: (s) => s.outboxRetryBacklog,
    action: { kind: 'route', path: '/observability/outbox?tab=retry' },
  },
]

export function buildAttentionItems(summary: AttentionSummary): AttentionItem[] {
  return RULES.flatMap((rule) => {
    const count = rule.count(summary)
    return count > 0 ? [{ key: rule.key, tone: rule.tone, count, action: rule.action }] : []
  })
}
