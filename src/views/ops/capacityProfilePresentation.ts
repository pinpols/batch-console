import type {
  CapacityProfileGroupBy,
  CapacityProfileReport,
  CapacityProfileRow,
} from '@/api/capacityProfile'

export interface CapacityBucket {
  from: string
  to: string
  label: string
}

export interface CapacityTrendPoint {
  label: string
  instanceCount: number
  taskCount: number
}

function toIso(value: number): string {
  return new Date(value).toISOString().slice(0, 19) + 'Z'
}

function bucketLabel(from: number, to: number): string {
  const options: Intl.DateTimeFormatOptions = {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  const format = new Intl.DateTimeFormat(undefined, options)
  if (new Date(from).toDateString() === new Date(to).toDateString()) return format.format(from)
  return `${format.format(from)} - ${format.format(to)}`
}

export function buildCapacityBuckets(range: [string, string], maxBuckets = 7): CapacityBucket[] {
  const from = Date.parse(range[0])
  const to = Date.parse(range[1])
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || maxBuckets < 1) return []

  const hours = Math.max(1, Math.ceil((to - from) / 3_600_000))
  const count = Math.min(maxBuckets, hours)
  const width = (to - from) / count
  return Array.from({ length: count }, (_, index) => {
    const bucketFrom = from + width * index
    const bucketTo = index === count - 1 ? to : from + width * (index + 1)
    return {
      from: toIso(bucketFrom),
      to: toIso(bucketTo),
      label: bucketLabel(bucketFrom, bucketTo),
    }
  })
}

export function capacityDimensionValue(
  row: CapacityProfileRow,
  groupBy: CapacityProfileGroupBy,
  fallbackTenant: string,
): string {
  if (groupBy === 'JOB') return row.jobCode || '—'
  if (groupBy === 'WORKER') return row.workerCode || '—'
  return row.tenantId || fallbackTenant || '—'
}

export function buildCapacityTrend(
  buckets: CapacityBucket[],
  reports: Array<CapacityProfileReport | null>,
): CapacityTrendPoint[] {
  return buckets.map((bucket, index) => ({
    label: bucket.label,
    instanceCount: Number(reports[index]?.totals?.instanceCount ?? 0),
    taskCount: Number(reports[index]?.totals?.taskCount ?? 0),
  }))
}

export function buildThroughputRanking(
  rows: CapacityProfileRow[],
  groupBy: CapacityProfileGroupBy,
  fallbackTenant: string,
) {
  return rows.map((row) => ({
    name: capacityDimensionValue(row, groupBy, fallbackTenant),
    value: Number(row.recordsPerSecond ?? 0),
  }))
}

export function buildLatencyComparison(
  rows: CapacityProfileRow[],
  groupBy: CapacityProfileGroupBy,
  fallbackTenant: string,
  limit = 10,
) {
  const selected = [...rows]
    .sort((a, b) => Number(b.p95DurationMs ?? 0) - Number(a.p95DurationMs ?? 0))
    .slice(0, limit)
  return {
    labels: selected.map((row) => capacityDimensionValue(row, groupBy, fallbackTenant)),
    average: selected.map((row) => Number(row.avgDurationMs ?? 0)),
    p95: selected.map((row) => Number(row.p95DurationMs ?? 0)),
  }
}
