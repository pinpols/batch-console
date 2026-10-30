export type WorkerAction = 'drain' | 'offline' | 'takeover' | 'warmup'

const ACTIONS_BY_STATUS: Record<string, readonly WorkerAction[]> = {
  ONLINE: ['drain', 'offline', 'takeover'],
  DRAINING: ['offline', 'takeover'],
  OFFLINE: ['warmup'],
  DECOMMISSIONED: [],
}

export function workerActionsForStatus(status: string | null | undefined): readonly WorkerAction[] {
  const statusText = String(status ?? '')
  const normalizedStatus = statusText.toUpperCase()
  return ACTIONS_BY_STATUS[normalizedStatus] ?? []
}

export function canWorkerAction(status: string | null | undefined, action: WorkerAction): boolean {
  return workerActionsForStatus(status).includes(action)
}
