import { get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type TriggerStatusResponse = components['schemas']['ConsoleTriggerStatusResponse']
type TriggerActionResponse = components['schemas']['TriggerActionResponse']

/** GET /api/console/ops/triggers，查询范围由登录身份的租户权限决定。 */
export function listTriggers() {
  return get<TriggerStatusResponse[]>('/api/console/ops/triggers')
}

/** POST /api/console/ops/triggers/{workflowCode}/register */
export function registerTrigger(workflowCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(workflowCode)}/register`,
    undefined,
    {
      params: { tenantId },
    },
  )
}

/** POST /api/console/ops/triggers/{workflowCode}/unregister */
export function unregisterTrigger(workflowCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(workflowCode)}/unregister`,
    undefined,
    { params: { tenantId } },
  )
}

/** POST /api/console/ops/triggers/{workflowCode}/pause */
export function pauseTrigger(workflowCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(workflowCode)}/pause`,
    undefined,
    {
      params: { tenantId },
    },
  )
}

/** POST /api/console/ops/triggers/{workflowCode}/resume */
export function resumeTrigger(workflowCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(workflowCode)}/resume`,
    undefined,
    {
      params: { tenantId },
    },
  )
}
