import type { CalendarDependencyWait, JobDependencyWait } from '@/api/dependencyWaits'
import type { PersistentWait } from '@/api/persistentWaits'

export function canRequestCalendarDependencyAction(
  wait: CalendarDependencyWait,
  canManage: boolean,
): boolean {
  return canManage && wait.waitStatus === 'WAITING' && !wait.manualAction
}

export function dependencySnapshotText(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item)).join(', ') || '—'
  } catch {
    return value
  }
  return value
}

export function waitStatusTone(status: CalendarDependencyWait['waitStatus'] | JobDependencyWait['waitStatus']) {
  if (status === 'WAITING') return 'warning'
  if (status === 'OPENED' || status === 'RELEASED') return 'success'
  return 'info'
}

export function persistentWaitStatusTone(status: PersistentWait['waitStatus']) {
  if (status === 'PENDING' || status === 'WAITING') return 'warning'
  if (status === 'RELEASED' || status === 'RESUMED') return 'success'
  if (status === 'TIMED_OUT' || status === 'REJECTED') return 'danger'
  return 'info'
}

export function persistentWaitRowKey(row: PersistentWait): string {
  return `${row.waitType}:${row.id}`
}
