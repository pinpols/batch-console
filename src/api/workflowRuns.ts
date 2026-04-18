import { post } from '@/api/client'

/** POST /api/console/workflow-runs/{id}/cancel */
export function cancelWorkflowRun(id: number, tenantId: string) {
  return post<string>(`/api/console/workflow-runs/${id}/cancel`, undefined, {
    params: { tenantId },
  })
}

/** POST /api/console/workflow-runs/{id}/terminate */
export function terminateWorkflowRun(id: number, tenantId: string) {
  return post<string>(`/api/console/workflow-runs/${id}/terminate`, undefined, {
    params: { tenantId },
  })
}

/** POST /api/console/workflow-runs/{id}/skip-node */
export function skipWorkflowRunNode(id: number, tenantId: string, nodeCode: string) {
  return post<string>(`/api/console/workflow-runs/${id}/skip-node`, undefined, {
    params: { tenantId, nodeCode },
  })
}
