import { get, post, del } from '@/api/client'

/** 后端 create 后回写一次性 plaintext key,前端 dialog 提示用户复制(只此一次) */
export interface CreateApiKeyResponse {
  id: number
  /** 一次性明文 key,后端只在 create 响应里返一次,后续 GET 不再下发 */
  rawKey: string
  keyName?: string
  scopes?: string
  expiresAt?: string | null
  [key: string]: unknown
}

/** GET /api/console/api-keys */
export function listApiKeys(tenantId: string) {
  return get<unknown>('/api/console/api-keys', { tenantId })
}

/** POST /api/console/api-keys */
export function createApiKey(
  tenantId: string,
  body: { keyName: string; scopes?: string; expiresAt?: string },
) {
  return post<CreateApiKeyResponse>('/api/console/api-keys', body, { params: { tenantId } })
}

/** GET /api/console/api-keys/{id} */
export function getApiKey(id: number, tenantId: string) {
  return get<unknown>(`/api/console/api-keys/${id}`, { tenantId })
}

/** DELETE /api/console/api-keys/{id} — revoke */
export function revokeApiKey(id: number, tenantId: string) {
  return del<void>(`/api/console/api-keys/${id}`, { params: { tenantId } })
}
