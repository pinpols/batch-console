import { get, post } from '@/api/client'

/** GET /api/console/triggers */
export function listTriggers(tenantId: string) {
  return get<unknown>('/api/console/triggers', { tenantId })
}

/** POST /api/console/triggers/{jobCode}/register */
export function registerTrigger(jobCode: string, tenantId: string) {
  return post<string>(`/api/console/triggers/${encodeURIComponent(jobCode)}/register`, undefined, {
    params: { tenantId },
  })
}

/** POST /api/console/triggers/{jobCode}/unregister */
export function unregisterTrigger(jobCode: string, tenantId: string) {
  return post<string>(
    `/api/console/triggers/${encodeURIComponent(jobCode)}/unregister`,
    undefined,
    { params: { tenantId } },
  )
}

/** POST /api/console/triggers/{jobCode}/pause */
export function pauseTrigger(jobCode: string, tenantId: string) {
  return post<string>(`/api/console/triggers/${encodeURIComponent(jobCode)}/pause`, undefined, {
    params: { tenantId },
  })
}

/** POST /api/console/triggers/{jobCode}/resume */
export function resumeTrigger(jobCode: string, tenantId: string) {
  return post<string>(`/api/console/triggers/${encodeURIComponent(jobCode)}/resume`, undefined, {
    params: { tenantId },
  })
}
