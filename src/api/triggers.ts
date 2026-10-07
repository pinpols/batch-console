import { get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type TriggerStatusResponse = components['schemas']['ConsoleTriggerStatusResponse']
type TriggerActionResponse = components['schemas']['ConsoleTriggerActionResponse']

/** GET /api/console/ops/triggers，查询范围由登录身份的租户权限决定。 */
export function listTriggers() {
  return get<TriggerStatusResponse[]>('/api/console/ops/triggers')
}

/** POST /api/console/ops/triggers/{jobCode}/register */
export function registerTrigger(jobCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/register`,
    undefined,
    {
      params: { tenantId },
    },
  )
}

/** POST /api/console/ops/triggers/{jobCode}/unregister */
export function unregisterTrigger(jobCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/unregister`,
    undefined,
    { params: { tenantId } },
  )
}

/** POST /api/console/ops/triggers/{jobCode}/pause */
export function pauseTrigger(jobCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/pause`,
    undefined,
    {
      params: { tenantId },
    },
  )
}

/** POST /api/console/ops/triggers/{jobCode}/resume */
export function resumeTrigger(jobCode: string, tenantId: string) {
  return post<TriggerActionResponse>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/resume`,
    undefined,
    {
      params: { tenantId },
    },
  )
}
