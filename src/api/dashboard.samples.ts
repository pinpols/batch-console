import type { DashboardBundle, DashboardPayload } from '@/api/dashboard'

export const dashboardMockPayloads: {
  jobStats: DashboardPayload
  triggerStats: DashboardPayload
  alertStats: DashboardPayload
  workerStats: DashboardPayload
  slaStats: DashboardPayload
} = {
  jobStats: {
    dailyTrend: [
      { date: '2026-03-29', runningJobs: 12, failedJobs: 1 },
      { date: '2026-03-30', runningJobs: 18, failedJobs: 2 },
      { date: '2026-03-31', runningJobs: 9, failedJobs: 0 },
    ],
  },
  triggerStats: {
    triggerTypeDistribution: [
      { triggerType: 'CRON', count: 28 },
      { triggerType: 'MANUAL', count: 5 },
      { triggerType: 'EVENT', count: 12 },
    ],
  },
  alertStats: {
    dailyTrend: [
      { date: '2026-03-29', openAlerts: 6, ackedAlerts: 2, closedAlerts: 4 },
      { date: '2026-03-30', openAlerts: 4, ackedAlerts: 3, closedAlerts: 8 },
      { date: '2026-03-31', openAlerts: 7, ackedAlerts: 1, closedAlerts: 5 },
    ],
  },
  workerStats: {
    groupDistribution: [
      { workerGroup: 'etl', count: 7 },
      { workerGroup: 'dispatch', count: 3 },
    ],
    statusDistribution: [
      { status: 'ONLINE', count: 8 },
      { status: 'DRAINING', count: 1 },
      { status: 'OFFLINE', count: 1 },
    ],
  },
  slaStats: {
    dailyTrend: [
      { date: '2026-03-29', onTimeCount: 88, violationCount: 4 },
      { date: '2026-03-30', onTimeCount: 91, violationCount: 2 },
      { date: '2026-03-31', onTimeCount: 84, violationCount: 6 },
    ],
  },
}

export const dashboardMockExpectedBundle: DashboardBundle = {
  jobs: {
    labels: ['2026-03-29', '2026-03-30', '2026-03-31'],
    series: {
      running: [12, 18, 9],
      failed: [1, 2, 0],
    },
  },
  alerts: {
    labels: ['2026-03-29', '2026-03-30', '2026-03-31'],
    series: {
      open: [6, 4, 7],
      acked: [2, 3, 1],
      closed: [4, 8, 5],
    },
  },
  sla: {
    labels: ['2026-03-29', '2026-03-30', '2026-03-31'],
    series: {
      onTime: [88, 91, 84],
      violation: [4, 2, 6],
    },
  },
  triggerTypes: {
    items: [
      { name: 'CRON', value: 28 },
      { name: 'MANUAL', value: 5 },
      { name: 'EVENT', value: 12 },
    ],
  },
  workerLoads: {
    items: [
      { name: 'etl', value: 7 },
      { name: 'dispatch', value: 3 },
      { name: 'ONLINE', value: 8 },
      { name: 'DRAINING', value: 1 },
      { name: 'OFFLINE', value: 1 },
    ],
  },
}

export const dashboardAliasPayloads: {
  jobStats: DashboardPayload
  triggerStats: DashboardPayload
  alertStats: DashboardPayload
  workerStats: DashboardPayload
  slaStats: DashboardPayload
} = {
  jobStats: {
    trend: [
      { day: 'D1', running: 5, failed: 1 },
      { day: 'D2', runningCount: 8, failedCount: 0 },
    ],
  },
  triggerStats: {
    distribution: [
      { label: 'API', value: 13 },
      { name: 'RETRY', total: 2 },
    ],
  },
  alertStats: {
    trend: [
      { label: 'D1', open: 3, acknowledged: 1, closed: 4 },
      { label: 'D2', openCount: 5, acked: 2, closedAlerts: 6 },
    ],
  },
  workerStats: {
    items: [
      { label: 'wg-a', currentLoad: 4 },
      { name: 'wg-b', activePartitions: 9 },
    ],
  },
  slaStats: {
    items: [
      { name: 'D1', onTime: 10, violations: 2 },
      { name: 'D2', successCount: 11, breachCount: 1 },
    ],
  },
}

export const dashboardAliasExpectedBundle: DashboardBundle = {
  jobs: {
    labels: ['D1', 'D2'],
    series: {
      running: [5, 8],
      failed: [1, 0],
    },
  },
  alerts: {
    labels: ['D1', 'D2'],
    series: {
      open: [3, 5],
      acked: [1, 2],
      closed: [4, 6],
    },
  },
  sla: {
    labels: ['D1', 'D2'],
    series: {
      onTime: [10, 11],
      violation: [2, 1],
    },
  },
  triggerTypes: {
    items: [
      { name: 'API', value: 13 },
      { name: 'RETRY', value: 2 },
    ],
  },
  workerLoads: {
    items: [
      { name: 'wg-a', value: 4 },
      { name: 'wg-b', value: 9 },
    ],
  },
}
