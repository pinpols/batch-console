export type RunLifecycleAction = 'pause' | 'resume'

/** 运行暂停与定时调度暂停是两个独立操作，均以服务端当前状态裁决。 */
export function runLifecycleAction(
  status: string | null | undefined,
  canWrite: boolean,
): RunLifecycleAction | null {
  if (!canWrite) return null
  if (status === 'RUNNING') return 'pause'
  if (status === 'PAUSED') return 'resume'
  return null
}

export function canCancelWorkflowExecution(
  status: string | null | undefined,
  canWrite: boolean,
): boolean {
  return canWrite && (status === 'CREATED' || status === 'RUNNING')
}

export function canTerminateWorkflowExecution(
  status: string | null | undefined,
  canWrite: boolean,
): boolean {
  return canWrite && status === 'RUNNING'
}
