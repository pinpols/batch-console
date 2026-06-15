export type WorkflowRunVisualClass = 'running' | 'success' | 'failed' | 'waiting' | 'cancelled'

interface WorkflowRunVisualToken {
  fill: string
  stroke: string
  text: string
}

export const workflowRunVisualTheme: Record<WorkflowRunVisualClass, WorkflowRunVisualToken> = {
  running: { fill: '#3b82f6', stroke: '#1d4ed8', text: '#ffffff' },
  success: { fill: '#10b981', stroke: '#047857', text: '#ffffff' },
  failed: { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
  waiting: { fill: '#f59e0b', stroke: '#b45309', text: '#ffffff' },
  cancelled: { fill: '#6b7280', stroke: '#374151', text: '#ffffff' },
}

export const workflowRunVisualClasses = Object.keys(
  workflowRunVisualTheme,
) as WorkflowRunVisualClass[]

export const workflowRunVisualCssVars = Object.fromEntries(
  workflowRunVisualClasses.flatMap((klass) => {
    const token = workflowRunVisualTheme[klass]
    return [
      [`--workflow-run-${klass}-fill`, token.fill],
      [`--workflow-run-${klass}-stroke`, token.stroke],
      [`--workflow-run-${klass}-text`, token.text],
    ]
  }),
) as Record<string, string>

export function workflowRunStatusClass(status?: string | null): WorkflowRunVisualClass | null {
  if (!status) return null
  const s = status.toUpperCase()
  if (s === 'RUNNING') return 'running'
  if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'SUCCEEDED') return 'success'
  if (s === 'FAILED' || s === 'PARTIAL_FAILED') return 'failed'
  if (s === 'WAITING' || s === 'READY' || s === 'CREATED') return 'waiting'
  if (s === 'CANCELLED' || s === 'SKIPPED' || s === 'TERMINATED') return 'cancelled'
  return null
}

export function workflowRunMermaidClassDefs(): string {
  return workflowRunVisualClasses
    .map((klass) => {
      const token = workflowRunVisualTheme[klass]
      return `  classDef ${klass} fill:${token.fill},stroke:${token.stroke},color:${token.text}`
    })
    .join('\n')
}
