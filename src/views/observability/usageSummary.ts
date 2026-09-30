import type { UsageSummaryRow } from '@/api/usage'

export function usageTotals(rows: UsageSummaryRow[]) {
  return rows.reduce(
    (totals, row) => {
      totals.events += row.eventCount
      if (row.source !== 'FRONTEND') {
        totals.success += row.successCount
        totals.failure += row.failureCount
      }
      return totals
    },
    { events: 0, success: 0, failure: 0 },
  )
}

export function usageDailyTrend(rows: UsageSummaryRow[]) {
  const dates = new Map<string, { date: string; success: number; failure: number }>()
  for (const row of rows) {
    if (row.source === 'FRONTEND') continue
    const item = dates.get(row.statDate) ?? { date: row.statDate, success: 0, failure: 0 }
    item.success += row.successCount
    item.failure += row.failureCount
    dates.set(row.statDate, item)
  }
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date))
}
