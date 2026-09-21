import type { ConsoleFileArrivalGroupResponse } from '@/types/console-api'

export function summarizeArrivalGroups(rows: ConsoleFileArrivalGroupResponse[]) {
  const result = rows.reduce(
    (summary, row) => {
      const state = String(row.arrivalState ?? '').toUpperCase()
      if (state === 'COMPLETE' || state === 'TRIGGERED') summary.readyGroups += 1
      if (state === 'WAITING' || state === 'PARTIAL') summary.waitingGroups += 1
      if (state === 'TIMEOUT') summary.timeoutGroups += 1
      summary.arrivedFiles += Number(row.arrivedCount ?? 0)
      summary.waitingFiles += Number(row.waitingCount ?? 0)
      summary.timeoutFiles += Number(row.timeoutCount ?? 0)
      summary.triggeredFiles += Number(row.triggeredCount ?? 0)
      return summary
    },
    {
      totalGroups: rows.length,
      readyGroups: 0,
      waitingGroups: 0,
      timeoutGroups: 0,
      arrivedFiles: 0,
      waitingFiles: 0,
      timeoutFiles: 0,
      triggeredFiles: 0,
    },
  )
  const trackedFiles = result.arrivedFiles + result.waitingFiles + result.timeoutFiles
  return {
    ...result,
    progress: trackedFiles > 0 ? Math.round((result.arrivedFiles / trackedFiles) * 100) : 0,
  }
}
