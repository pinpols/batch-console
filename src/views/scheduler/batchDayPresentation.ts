import type { ConsoleBatchDayResponse } from '@/types/console-api'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function monthDateRange(date: Date): { from: string; to: string } {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { from: toLocalDateKey(first), to: toLocalDateKey(last) }
}

export function indexBatchDays(
  rows: ConsoleBatchDayResponse[],
): Map<string, ConsoleBatchDayResponse> {
  return new Map(rows.map((row) => [row.bizDate, row]))
}

export function summarizeBatchDays(rows: ConsoleBatchDayResponse[]) {
  return rows.reduce(
    (summary, row) => {
      summary.days += 1
      summary.totalJobs += Number(row.totalJobCount ?? 0)
      summary.success += Number(row.successJobCount ?? 0)
      summary.failed += Number(row.failedJobCount ?? 0)
      summary.inFlight += Number(row.inFlightJobCount ?? 0)
      summary.late += Number(row.lateCount ?? 0)
      return summary
    },
    { days: 0, totalJobs: 0, success: 0, failed: 0, inFlight: 0, late: 0 },
  )
}
