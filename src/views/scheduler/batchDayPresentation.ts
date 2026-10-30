import type { ConsoleBatchDayResponse } from '@/types/console-api'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function monthDateRange(date: Date): { from: string; to: string } {
  const year = date.getFullYear()
  const month = date.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { from: toLocalDateKey(first), to: toLocalDateKey(last) }
}

export function monthGridDates(date: Date): Date[] {
  const firstBoundaryYear = date.getFullYear()
  const firstBoundaryMonth = date.getMonth()
  const first = new Date(firstBoundaryYear, firstBoundaryMonth, 1)
  const lastBoundaryYear = date.getFullYear()
  const lastBoundaryMonth = date.getMonth()
  const monthAfterLastBoundary = lastBoundaryMonth + 1
  const last = new Date(lastBoundaryYear, monthAfterLastBoundary, 0)
  const firstDayOfWeek = first.getDay()
  const lastDayOfWeek = last.getDay()
  const mondayBasedFirstDay = (firstDayOfWeek + 6) % 7
  const mondayBasedLastDay = (lastDayOfWeek + 6) % 7
  const startOffset = mondayBasedFirstDay
  const endOffset = (7 - mondayBasedLastDay - 1) % 7
  const firstYear = first.getFullYear()
  const firstMonth = first.getMonth()
  const start = new Date(firstYear, firstMonth, 1 - startOffset)
  const lastYear = last.getFullYear()
  const lastMonth = last.getMonth()
  const lastDayOfMonth = last.getDate()
  const end = new Date(lastYear, lastMonth, lastDayOfMonth + endOffset)
  const dates: Date[] = []

  for (const current = start; current <= end; current.setDate(current.getDate() + 1)) {
    const year = current.getFullYear()
    const month = current.getMonth()
    const day = current.getDate()
    dates.push(new Date(year, month, day))
  }

  return dates
}

export function indexBatchDays(
  rows: ConsoleBatchDayResponse[],
): Map<string, ConsoleBatchDayResponse> {
  const dateEntries: Array<[string, ConsoleBatchDayResponse]> = rows.map((row) => [row.bizDate, row])
  return new Map(dateEntries)
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
