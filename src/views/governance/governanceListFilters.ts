import type {
  GovernanceQueueRow,
  GovernanceBatchWindowRow,
  GovernanceCalendarRow,
} from '@/api/governance'

function matchesEnabled(value: boolean, enabled: boolean | undefined): boolean {
  return enabled === undefined ? true : value === enabled
}

/** 列表筛选保留页面原有的字段范围、大小写与启用状态口径。 */
export function filterGovernanceQueues(
  rows: GovernanceQueueRow[],
  keyword: string,
  enabled: boolean | undefined,
): GovernanceQueueRow[] {
  const trimmedKeyword = keyword.trim()
  const k = trimmedKeyword.toLowerCase()
  return rows.filter(
    (row) =>
      matchesEnabled(row.enabled, enabled) &&
      (!k || `${row.queueCode} ${row.queueName} ${row.queueType}`.toLowerCase().includes(k)),
  )
}

export function filterGovernanceWindows(
  rows: GovernanceBatchWindowRow[],
  keyword: string,
  enabled: boolean | undefined,
): GovernanceBatchWindowRow[] {
  const trimmedKeyword = keyword.trim()
  const k = trimmedKeyword.toLowerCase()
  return rows.filter(
    (row) =>
      matchesEnabled(row.enabled, enabled) &&
      (!k || `${row.windowCode} ${row.windowName} ${row.crossDayPolicy}`.toLowerCase().includes(k)),
  )
}

export function filterGovernanceCalendars(
  rows: GovernanceCalendarRow[],
  keyword: string,
  enabled: boolean | undefined,
): GovernanceCalendarRow[] {
  const trimmedKeyword = keyword.trim()
  const k = trimmedKeyword.toLowerCase()
  return rows.filter(
    (row) =>
      matchesEnabled(row.enabled, enabled) &&
      (!k || `${row.calendarCode} ${row.calendarName} ${row.timezone}`.toLowerCase().includes(k)),
  )
}
