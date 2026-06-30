import { get } from '@/api/client'

export type CapacityProfileGroupBy = 'TENANT' | 'JOB' | 'WORKER'

export interface CapacityProfileWindow {
  from?: string
  to?: string
}

export interface CapacityProfileTotals {
  instanceCount: number
  taskCount: number
  successCount: number
  failureCount: number
  totalDurationMs: number
  totalFileBytes: number
  processedRecords: number
}

export interface CapacityProfileCoverage {
  evidenceSource?: string
  knownGaps?: string[]
  rejectedScopes?: string[]
}

export interface CapacityProfileRow {
  tenantId?: string
  jobCode?: string
  workerCode?: string
  workerGroup?: string
  instanceCount: number
  taskCount: number
  successCount: number
  failureCount: number
  totalDurationMs: number
  avgDurationMs: number
  p95DurationMs: number
  totalFileBytes: number
  processedRecords: number
  recordsPerSecond: number
  mbPerSecond: number
}

export interface CapacityProfileReport {
  generatedAt?: string
  tenantId?: string
  window?: CapacityProfileWindow
  groupBy?: CapacityProfileGroupBy
  scope?: string
  rows?: CapacityProfileRow[]
  totals?: CapacityProfileTotals
  coverage?: CapacityProfileCoverage
}

export interface CapacityProfileQuery {
  tenantId: string
  from?: string
  to?: string
  groupBy?: CapacityProfileGroupBy
  limit?: number
}

export function getCapacityProfile(query: CapacityProfileQuery) {
  return get<CapacityProfileReport>('/api/console/capacity-profile', {
    tenantId: query.tenantId,
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.groupBy ? { groupBy: query.groupBy } : {}),
    ...(query.limit != null ? { limit: query.limit } : {}),
  })
}
