import type { ConsoleJobInstanceResponse } from '@/types/console-api'

export const TERMINAL_INSTANCE_STATUSES = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'CANCELED',
  'TERMINATED',
]

export function canSelectJobInstanceForBulk(row: ConsoleJobInstanceResponse): boolean {
  return row.instanceStatus === 'FAILED' || !TERMINAL_INSTANCE_STATUSES.includes(row.instanceStatus)
}
