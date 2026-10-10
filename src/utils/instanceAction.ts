export type InstanceCancelOutcome = 'requested' | 'completed' | 'accepted'

const CANCELLABLE_STATUSES = new Set(['CREATED', 'WAITING', 'READY', 'RUNNING'])

export function canCancelInstance(status: string): boolean {
  return CANCELLABLE_STATUSES.has(status.trim().toUpperCase())
}

export function canTerminateInstance(status: string): boolean {
  return status.trim().toUpperCase() === 'RUNNING'
}

export function resolveInstanceCancelOutcome(status: string): InstanceCancelOutcome {
  const normalizedStatus = status.trim().toUpperCase()
  if (normalizedStatus === 'CANCEL_REQUESTED') return 'requested'
  if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED') return 'completed'
  return 'accepted'
}
