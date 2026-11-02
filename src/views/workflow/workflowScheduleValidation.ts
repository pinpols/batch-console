import type { ConsoleWorkflowDefinitionResponse } from '@/types/console-api'

export type WorkflowScheduleLengthField =
  'scheduleExpr' | 'timezone' | 'calendarCode' | 'dependsOnJobCode'

type ScheduleValues = Record<WorkflowScheduleLengthField, string> & { scheduleType: string }

const FIELD_LIMITS: ReadonlyArray<readonly [WorkflowScheduleLengthField, number]> = [
  ['scheduleExpr', 256],
  ['timezone', 64],
  ['calendarCode', 128],
  ['dependsOnJobCode', 128],
]

export function validateWorkflowScheduleLengths(
  values: ScheduleValues,
): { field: WorkflowScheduleLengthField; max: number } | null {
  for (const [field, max] of FIELD_LIMITS) {
    if (field === 'scheduleExpr' && values.scheduleType === 'MANUAL') continue
    if (values[field].length > max) return { field, max }
  }
  return null
}

export function isScheduled(row: ConsoleWorkflowDefinitionResponse): boolean {
  return (
    ['CRON', 'FIXED_RATE'].includes(row.scheduleType ?? '') &&
    ['SCHEDULED', 'MIXED'].includes(row.triggerMode ?? '')
  )
}
