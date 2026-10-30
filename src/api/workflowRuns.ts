import type { AxiosRequestConfig } from 'axios'
import { get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type WorkflowRunReplayRequest = components['schemas']['WorkflowRunReplayRequest']
type WorkflowRunReplayPreview = components['schemas']['ConsoleWorkflowRunReplayPreviewResponse']
type WorkflowRunReplaySubmission =
  components['schemas']['ConsoleWorkflowRunReplaySubmissionResponse']

export function pauseWorkflowRun(id: number, tenantId: string) {
  return post<components['schemas']['ConsoleWorkflowRunActionResponse']>(
    `/api/console/workflow-runs/${id}/pause`,
    undefined,
    { params: { tenantId } },
  )
}

export function resumeWorkflowRun(id: number, tenantId: string) {
  return post<components['schemas']['ConsoleWorkflowRunActionResponse']>(
    `/api/console/workflow-runs/${id}/resume`,
    undefined,
    { params: { tenantId } },
  )
}

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
export function skipWorkflowRunNode(
  id: number,
  tenantId: string,
  nodeCode: string,
  reason: string,
) {
  return post<string>(`/api/console/workflow-runs/${id}/skip-node`, undefined, {
    params: { tenantId, nodeCode, reason },
  })
}

/** POST /api/console/jobs/workflow-run/replay-preview */
export function previewWholeWorkflowReplay(body: WorkflowRunReplayRequest) {
  return post<WorkflowRunReplayPreview>('/api/console/jobs/workflow-run/replay-preview', body)
}

/** POST /api/console/jobs/workflow-run/replay-operations */
export function submitWholeWorkflowReplay(body: WorkflowRunReplayRequest, idempotencyKey: string) {
  return post<WorkflowRunReplaySubmission>(
    '/api/console/jobs/workflow-run/replay-operations',
    body,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
}

export type WorkflowExecutionProgress = components['schemas']['WorkflowExecutionProgress']

export function getWorkflowExecutionProgress(id: number, tenantId: string) {
  return get<WorkflowExecutionProgress>(
    `/api/console/workflow-runs/${id}/execution-progress`,
    {
      tenantId,
    },
    { _silent: true } as AxiosRequestConfig,
  )
}
