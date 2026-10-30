import type { ConsoleJobInstanceResponse } from '@/types/console-api'

export const TERMINAL_INSTANCE_STATUSES = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'CANCELED',
  'TERMINATED',
  'PARTIAL_FAILED',
  'SUCCESS_DRY_RUN',
  'FAILED_DRY_RUN',
]

export function canSelectJobInstanceForBulk(row: ConsoleJobInstanceResponse): boolean {
  return row.instanceStatus === 'FAILED' || !TERMINAL_INSTANCE_STATUSES.includes(row.instanceStatus)
}
