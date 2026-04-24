import { get, post } from '@/api/client'

/** GET /api/console/ops/triggers */
export function listTriggers(tenantId: string) {
  return get<unknown>('/api/console/ops/triggers', { tenantId })
}

/** POST /api/console/ops/triggers/{jobCode}/register */
export function registerTrigger(jobCode: string, tenantId: string) {
  return post<string>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/register`,
    undefined,
    {
      params: { tenantId },
    },
  )
}

/** POST /api/console/ops/triggers/{jobCode}/unregister */
export function unregisterTrigger(jobCode: string, tenantId: string) {
  return post<string>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/unregister`,
    undefined,
    { params: { tenantId } },
  )
}

/** POST /api/console/ops/triggers/{jobCode}/pause */
export function pauseTrigger(jobCode: string, tenantId: string) {
  return post<string>(`/api/console/ops/triggers/${encodeURIComponent(jobCode)}/pause`, undefined, {
    params: { tenantId },
  })
}

/** POST /api/console/ops/triggers/{jobCode}/resume */
export function resumeTrigger(jobCode: string, tenantId: string) {
  return post<string>(
    `/api/console/ops/triggers/${encodeURIComponent(jobCode)}/resume`,
    undefined,
    {
      params: { tenantId },
    },
  )
}
