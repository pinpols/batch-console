import { get, put, del } from '@/api/client'

/** GET /api/console/system-parameters */
export function listSystemParameters(tenantId: string) {
  return get<unknown>('/api/console/system-parameters', { tenantId })
}

/** GET /api/console/system-parameters/value */
export function getSystemParameterValue(tenantId: string, key: string) {
  return get<unknown>('/api/console/system-parameters/value', { tenantId, key })
}

/** PUT /api/console/system-parameters */
export function upsertSystemParameter(
  tenantId: string,
  body: { key: string; value: string; description?: string },
) {
  return put<void>('/api/console/system-parameters', body, { params: { tenantId } })
}

/** DELETE /api/console/system-parameters */
export function deleteSystemParameter(tenantId: string, key: string) {
  return del<void>('/api/console/system-parameters', { params: { tenantId, key } })
}
