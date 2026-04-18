import { get, post } from '@/api/client'

/** GET /api/console/tenants/quota */
export function getTenantQuota(tenantId: string) {
  return get<unknown>('/api/console/tenants/quota', { tenantId })
}

/** GET /api/console/tenants/usage */
export function getTenantUsage(tenantId: string) {
  return get<unknown>('/api/console/tenants/usage', { tenantId })
}

/** POST /api/console/tenants/quota/request */
export function requestQuotaChange(
  tenantId: string,
  body: { quotaKey: string; requestedValue: string; reason: string },
) {
  return post<void>('/api/console/tenants/quota/request', body, { params: { tenantId } })
}
