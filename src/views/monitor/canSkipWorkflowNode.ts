export function canSkipWorkflowNode(status?: string | null): boolean {
  const statusText = String(status ?? '')
  const normalizedStatus = statusText.toUpperCase()
  return normalizedStatus === 'FAILED'
}
