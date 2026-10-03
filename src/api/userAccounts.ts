/**
 * 用户账户管理（管理员）—— /api/console/users
 *
 * 后端协议：console-api-protocol.md `User Account Management`
 * - 所有操作均要求 ROLE_ADMIN
 * - 密码仅以 Argon2id 哈希存储，响应中永远不包含 passwordHash
 */
import { apiClient, get, post, put } from '@/api/client'
import type { components } from '@/types/api.generated'

const BATCH_BASE = '/api/console/users/batch'
export type UserBatchAccountRow = components['schemas']['UserBatchAccountRow']
export type UserBatchPreview = components['schemas']['UserBatchPreview']
export type UserBatchApplyResult = components['schemas']['UserBatchApplyResult']
export type UserBatchOperation = components['schemas']['UserBatchOperation']

export interface UserAccount {
  id: number
  tenantId: string
  username: string
  displayName?: string
  authoritiesCsv?: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface UserListQuery {
  tenantId?: string
  keyword?: string
  enabled?: boolean
  pageNo?: number
  pageSize?: number
}

export interface UserPage {
  total: number
  pageNo: number
  pageSize: number
  items: UserAccount[]
}

export interface UpdateUserRequest {
  displayName?: string
  authoritiesCsv?: string
}

export interface CreateUserRequest {
  tenantId?: string
  username: string
  password: string
  displayName?: string
  authoritiesCsv?: string
}

export interface ResetPasswordRequest {
  newPassword: string
}

/** GET /api/console/users */
export function listUsers(query: UserListQuery = {}) {
  return get<UserPage>('/api/console/users', query)
}

/** GET /api/console/users/{id} */
export function getUser(id: number) {
  return get<UserAccount>(`/api/console/users/${id}`)
}

/** POST /api/console/users — 管理员创建账户 */
export function createUser(body: CreateUserRequest) {
  return post<UserAccount>('/api/console/users', body)
}

/** PUT /api/console/users/{id} */
export function updateUser(id: number, body: UpdateUserRequest) {
  return put<UserAccount>(`/api/console/users/${id}`, body)
}

/** POST /api/console/users/{id}/reset-password */
export function resetUserPassword(id: number, body: ResetPasswordRequest) {
  return post<void>(`/api/console/users/${id}/reset-password`, body)
}

/** POST /api/console/users/{id}/enable */
export function enableUser(id: number) {
  return post<UserAccount>(`/api/console/users/${id}/enable`)
}

/** POST /api/console/users/{id}/disable */
export function disableUser(id: number) {
  return post<UserAccount>(`/api/console/users/${id}/disable`)
}

export async function downloadUserBatchTemplate(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${BATCH_BASE}/template`, { responseType: 'blob' })
  return data
}

export function previewUserBatch(file: File): Promise<UserBatchPreview> {
  const body = new FormData()
  body.append('file', file)
  return post<UserBatchPreview>(`${BATCH_BASE}/preview`, body)
}

export function patchUserBatch(token: string, version: number, row: UserBatchAccountRow) {
  return post<UserBatchPreview>(`${BATCH_BASE}/preview/${encodeURIComponent(token)}/patch`, {
    version,
    row,
  })
}

export function applyUserBatch(token: string, version: number, requestId: string) {
  return post<UserBatchApplyResult>(
    `${BATCH_BASE}/apply/${encodeURIComponent(token)}`,
    { version, requestId },
    { headers: { 'Idempotency-Key': requestId }, timeout: 60_000 },
  )
}

export function findUserBatchOperation(requestId: string) {
  return get<UserBatchOperation | null>(`${BATCH_BASE}/operations`, { requestId })
}
