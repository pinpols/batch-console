import type { BatchDayOperateRequest } from '@/api/batchDays'
export type BatchDayAction = NonNullable<BatchDayOperateRequest['action']>
const terminalStatuses = new Set(['SETTLED', 'FAILED', 'SKIPPED', 'MANUAL_RELEASED'])
const knownStatuses = new Set(['OPEN', 'IN_FLIGHT', 'CUTOFF', 'SETTLING', ...terminalStatuses])

/** 只约束已知状态；依赖等待、触发请求和乐观锁冲突仍由服务端最终裁决。 */
export function availableBatchDayActions(
  day: { dayStatus?: string | null; frozen?: boolean | null } | null,
): BatchDayAction[] {
  if (!day?.dayStatus || !knownStatuses.has(day.dayStatus) || day.frozen == null) return []
  const actions: BatchDayAction[] = []
  const terminal = terminalStatuses.has(day.dayStatus)
  if (!terminal && !day.frozen) actions.push('FREEZE')
  actions.push('RELEASE')
  if (!terminal) actions.push('SKIP')
  if (terminal) actions.push('REOPEN')
  if (day.dayStatus !== 'SETTLED') actions.push('CLOSE')
  if (day.dayStatus === 'CUTOFF') actions.push('SETTLE_EMPTY')
  return actions
}
export function validGapRange(from: string, through: string, latest?: string): boolean {
  if (latest && through > latest) return false
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? date.getTime()
      : NaN
  }
  const days = (parse(through) - parse(from)) / 86_400_000
  return Number.isFinite(days) && days >= 0 && days < 90
}
