import { get } from '@/api/client'

export type DashboardPayload = Record<string, unknown>

export interface DashboardLineMetric {
  labels: string[]
  series: Record<string, number[]>
}

export interface DashboardDistributionMetric {
  items: Array<{ name: string; value: number }>
}

export interface DashboardBundle {
  jobs: DashboardLineMetric
  alerts: DashboardLineMetric
  sla: DashboardLineMetric & { totalWithSla: number }
  triggerTypes: DashboardDistributionMetric
  workerLoads: DashboardDistributionMetric
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function pickArray(obj: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const value = obj[key]
    if (Array.isArray(value)) return value as Record<string, unknown>[]
  }
  return []
}

function pickNumber(obj: Record<string, unknown>, candidates: string[], fallback = 0) {
  for (const key of candidates) {
    const value = obj[key]
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function pickString(obj: Record<string, unknown>, candidates: string[], fallback = '') {
  for (const key of candidates) {
    const value = obj[key]
    if (value != null && value !== '') return String(value)
  }
  return fallback
}

function normalizeLabels(rows: Record<string, unknown>[]) {
  return rows.map((row, i) => pickString(row, ['date', 'day', 'label', 'name'], `#${i + 1}`))
}

function normalizeDistribution(
  rows: Record<string, unknown>[],
  nameKeys: string[],
  valueKeys: string[],
): DashboardDistributionMetric {
  const metricCandidates = rows.map((row) => ({
    name: pickString(row, nameKeys),
    value: pickNumber(row, valueKeys),
  }))
  const visibleMetrics = metricCandidates.filter((item) => item.name || item.value > 0)
  return {
    items: visibleMetrics,
  }
}

export function getDashboardJobStats(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/job-stats', { tenantId, days })
}

export function getDashboardTriggerStats(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/trigger-stats', { tenantId, days })
}

export function getDashboardWorkerLoad(tenantId: string) {
  return get<DashboardPayload>('/api/console/dashboard/worker-load', { tenantId })
}

export function getDashboardAlertTrend(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/alert-trend', { tenantId, days })
}

export function getDashboardSlaCompliance(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/sla-compliance', { tenantId, days })
}

export function normalizeDashboardBundle(input: {
  jobStats: DashboardPayload
  triggerStats: DashboardPayload
  alertStats: DashboardPayload
  workerStats: DashboardPayload
  slaStats: DashboardPayload
}): DashboardBundle {
  const { jobStats, triggerStats, alertStats, workerStats, slaStats } = input
  const jobStatsObject = asObject(jobStats)
  const jobRows = pickArray(jobStatsObject, ['dailyTrend', 'trend', 'items', 'series'])
  const alertStatsObject = asObject(alertStats)
  const alertRows = pickArray(alertStatsObject, ['dailyTrend', 'trend', 'items'])
  const slaStatsObject = asObject(slaStats)
  const slaRows = pickArray(slaStatsObject, ['dailyTrend', 'trend', 'items'])
  const triggerStatsObject = asObject(triggerStats)
  const triggerRows = pickArray(triggerStatsObject, [
    'triggerTypeDistribution',
    'distribution',
    'items',
  ])
  const workerStatsObject = asObject(workerStats)
  const workerGroupRows = pickArray(workerStatsObject, ['groupDistribution'])
  const workerStatusRows = pickArray(workerStatsObject, ['statusDistribution'])
  const workerItemRows = pickArray(workerStatsObject, ['items'])
  const workerRows = [...workerGroupRows, ...workerStatusRows, ...workerItemRows]

  return {
    jobs: {
      labels: normalizeLabels(jobRows),
      series: {
        running: jobRows.map((row) => pickNumber(row, ['runningJobs', 'running', 'runningCount'])),
        failed: jobRows.map((row) => pickNumber(row, ['failedJobs', 'failed', 'failedCount'])),
      },
    },
    alerts: {
      labels: normalizeLabels(alertRows),
      series: {
        open: alertRows.map((row) => pickNumber(row, ['openAlerts', 'open', 'openCount'])),
        acked: alertRows.map((row) => pickNumber(row, ['ackedAlerts', 'acked', 'acknowledged'])),
        closed: alertRows.map((row) => pickNumber(row, ['closedAlerts', 'closed'])),
      },
    },
    sla: {
      totalWithSla: pickNumber(slaStatsObject, ['totalWithSla']),
      labels: normalizeLabels(slaRows),
      series: {
        onTime: slaRows.map((row) => pickNumber(row, ['onTimeCount', 'onTime', 'successCount'])),
        violation: slaRows.map((row) =>
          pickNumber(row, ['breached', 'violationCount', 'violations', 'breachCount']),
        ),
      },
    },
    triggerTypes: normalizeDistribution(
      triggerRows,
      ['triggerType', 'name', 'label'],
      ['count', 'value', 'total'],
    ),
    workerLoads: normalizeDistribution(
      workerRows,
      ['workerGroup', 'status', 'name', 'label'],
      ['count', 'value', 'total', 'currentLoad', 'activePartitions'],
    ),
  }
}

/** GET /api/console/dashboard/sla-report */
export function getDashboardSlaReport(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/sla-report', { tenantId, days })
}

/** GET /api/console/dashboard/execution-progress */
export function getDashboardExecutionProgress(
  tenantId: string,
  jobCode?: string,
  bizDate?: string,
) {
  return get<DashboardPayload>('/api/console/dashboard/execution-progress', {
    tenantId,
    ...(jobCode ? { jobCode } : {}),
    ...(bizDate ? { bizDate } : {}),
  })
}

/** GET /api/console/dashboard/tenant-usage */
export function getDashboardTenantUsage(tenantId: string, days?: number) {
  return get<DashboardPayload>('/api/console/dashboard/tenant-usage', {
    tenantId,
    ...(days != null ? { days } : {}),
  })
}

export async function getDashboardBundle(
  tenantId: string,
  days?: number,
): Promise<DashboardBundle> {
  const [jobStats, triggerStats, alertStats, workerStats, slaStats] = await Promise.all([
    getDashboardJobStats(tenantId, days),
    getDashboardTriggerStats(tenantId, days),
    getDashboardAlertTrend(tenantId, days),
    getDashboardWorkerLoad(tenantId),
    getDashboardSlaCompliance(tenantId, days),
  ])

  return normalizeDashboardBundle({
    jobStats,
    triggerStats,
    alertStats,
    workerStats,
    slaStats,
  })
}
