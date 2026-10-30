import type { BatchDayOperateRequest, BatchDayCatchupControlRequest } from '@/api/batchDays'
import { STORAGE_KEYS } from '@/constants/storageKeys'

export type BatchDayCommand = (
  | { kind: 'day'; body: BatchDayOperateRequest }
  | { kind: 'catchup'; body: BatchDayCatchupControlRequest }
) & { key: string; scope: string; createdAt: number; actor: string }
const actions = ['FREEZE', 'RELEASE', 'SKIP', 'REOPEN', 'CLOSE', 'SETTLE_EMPTY']
// 服务端幂等保留24小时；客户端提前1小时停止自动重试，避免过期后重复执行。
const maxRecoveryAge = 23 * 60 * 60 * 1000
function storageKey(scope: string) {
  return STORAGE_KEYS.batchDayGovernanceRecoveryPrefix + encodeURIComponent(scope)
}
export function restoreBatchDayCommand(
  scope: string,
  storage?: Storage,
  now = Date.now(),
): { command: BatchDayCommand | null; blocked: boolean } {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(storageKey(scope))
    if (raw == null) return { command: null, blocked: false }
    const value = JSON.parse(raw) as BatchDayCommand
    const body = value?.body
    const valid =
      value.scope === scope &&
      typeof value.key === 'string' &&
      value.key.length > 0 &&
      Number.isFinite(value.createdAt) &&
      value.createdAt <= now &&
      now - value.createdAt < maxRecoveryAge &&
      body &&
      typeof body.tenantId === 'string' &&
      typeof body.calendarCode === 'string' &&
      typeof value.actor === 'string' &&
      value.actor.length > 0 &&
      `${value.actor}\0${body.tenantId}\0${body.calendarCode}` === scope &&
      typeof body.reason === 'string' &&
      body.reason.trim().length > 0 &&
      body.reason.length <= 1024 &&
      (value.kind === 'day'
        ? actions.includes(value.body.action ?? '') &&
          /^\d{4}-\d{2}-\d{2}$/.test(value.body.bizDate)
        : value.kind === 'catchup' && ['PAUSE', 'RESUME'].includes(value.body.action))
    return valid ? { command: value, blocked: false } : { command: null, blocked: true }
  } catch {
    return { command: null, blocked: true }
  }
}
export function saveBatchDayCommand(command: BatchDayCommand, storage?: Storage): boolean {
  try {
    ;(storage ?? window.sessionStorage).setItem(storageKey(command.scope), JSON.stringify(command))
    return true
  } catch {
    return false
  }
}
export function clearBatchDayCommand(
  command: Pick<BatchDayCommand, 'scope' | 'key'>,
  storage?: Storage,
): boolean {
  try {
    const target = storage ?? window.sessionStorage
    const key = storageKey(command.scope)
    const raw = target.getItem(key)
    if (raw != null && (JSON.parse(raw) as BatchDayCommand).key !== command.key) return false
    target.removeItem(key)
    return true
  } catch {
    return false
  }
}
