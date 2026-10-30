export type InstanceCancelOutcome = 'requested' | 'completed' | 'accepted'

const CANCELLABLE_STATUSES = new Set(['CREATED', 'WAITING', 'READY', 'RUNNING'])

export function canCancelInstance(status: string): boolean {
  const trimmedStatus = status.trim()
  const normalizedStatus = trimmedStatus.toUpperCase()
  return CANCELLABLE_STATUSES.has(normalizedStatus)
}

export function canTerminateInstance(status: string): boolean {
  const trimmedStatus = status.trim()
  const normalizedStatus = trimmedStatus.toUpperCase()
  return normalizedStatus === 'RUNNING'
}

export function resolveInstanceCancelOutcome(status: string): InstanceCancelOutcome {
  const trimmedStatus = status.trim()
  const normalizedStatus = trimmedStatus.toUpperCase()
  if (normalizedStatus === 'CANCEL_REQUESTED') return 'requested'
  if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED') return 'completed'
  return 'accepted'
}
