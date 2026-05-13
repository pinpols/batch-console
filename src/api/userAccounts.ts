/**
 * 用户账户管理（管理员）—— /api/console/users
 *
 * 后端协议：console-api-protocol.md `User Account Management`
 * - 所有操作均要求 ROLE_ADMIN
 * - 密码仅以 Argon2id 哈希存储，响应中永远不包含 passwordHash
 */
import { get, post, put } from '@/api/client'

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

/** POST /api/console/users — admin creates a new account */
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
