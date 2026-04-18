import { get, post, del } from '@/api/client'

/** GET /api/console/api-keys */
export function listApiKeys(tenantId: string) {
  return get<unknown>('/api/console/api-keys', { tenantId })
}

/** POST /api/console/api-keys */
export function createApiKey(
  tenantId: string,
  body: { keyName: string; scopes?: string; expiresAt?: string },
) {
  return post<unknown>('/api/console/api-keys', body, { params: { tenantId } })
}

/** GET /api/console/api-keys/{id} */
export function getApiKey(id: number, tenantId: string) {
  return get<unknown>(`/api/console/api-keys/${id}`, { tenantId })
}

/** DELETE /api/console/api-keys/{id} — revoke */
export function revokeApiKey(id: number, tenantId: string) {
  return del<void>(`/api/console/api-keys/${id}`, { params: { tenantId } })
}
