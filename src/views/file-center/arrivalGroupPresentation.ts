import type { ConsoleFileArrivalGroupResponse } from '@/types/console-api'

export function summarizeArrivalGroups(rows: ConsoleFileArrivalGroupResponse[]) {
  const groups = new Set<string>()
  const readyGroups = new Set<string>()
  const waitingGroups = new Set<string>()
  const timeoutGroups = new Set<string>()
  const result = rows.reduce(
    (summary, row) => {
      const group = JSON.stringify([row.tenantId, row.fileGroupCode])
      groups.add(group)
      const arrivalStateText = String(row.arrivalState ?? '')
      const state = arrivalStateText.toUpperCase()
      if (state === 'COMPLETE' || state === 'TRIGGERED') readyGroups.add(group)
      if (state.startsWith('WAITING') || state === 'PARTIAL') {
        waitingGroups.add(group)
      }
      if (state === 'TIMEOUT') timeoutGroups.add(group)
      summary.arrivedFiles += Number(row.arrivedCount ?? 0)
      summary.waitingFiles += Number(row.waitingCount ?? 0)
      summary.timeoutFiles += Number(row.timeoutCount ?? 0)
      summary.triggeredFiles += Number(row.triggeredCount ?? 0)
      return summary
    },
    {
      arrivedFiles: 0,
      waitingFiles: 0,
      timeoutFiles: 0,
      triggeredFiles: 0,
    },
  )
  return {
    totalGroups: groups.size,
    readyGroups: readyGroups.size,
    waitingGroups: waitingGroups.size,
    timeoutGroups: timeoutGroups.size,
    ...result,
  }
}
