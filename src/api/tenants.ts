/**
 * 租户管理（管理员）—— /api/console/tenants
 *
 * 后端协议：console-api-protocol.md `Tenant Management`
 * - 读操作：ROLE_ADMIN / ROLE_TENANT_ADMIN
 * - 写操作：ROLE_ADMIN
 */
import { get, post, put } from '@/api/client'

export type TenantStatus = 'ACTIVE' | 'SUSPENDING' | 'SUSPENDED' | 'ACTIVATING'

export interface Tenant {
  id?: number
  tenantId: string
  tenantName: string
  status: TenantStatus
  description?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface TenantListQuery {
  keyword?: string
  status?: TenantStatus
  pageNo?: number
  pageSize?: number
}

export interface TenantPage {
  total: number
  pageNo: number
  pageSize: number
  items: Tenant[]
}

export interface CreateTenantRequest {
  tenantId: string
  tenantName: string
  description?: string
  /** 初始操作账号用户名（ROLE_TENANT_USER） */
  username: string
  /** 初始操作账号密码（Argon2id hashed on server） */
  password: string
}

export interface BatchCreateTenantsRequest {
  tenants: { tenantId: string; tenantName: string; description?: string }[]
  /** 账号用户名前缀，最终用户名为 {prefix}{tenantId}，默认 "op-" */
  usernamePrefix?: string
  /** 批量初始密码（≥12 位） */
  password: string
  /** 可选，配置初始化源租户 ID（如 default-tenant），非空时自动复制源租户全部配置 */
  initConfigFrom?: string
  /** 配置初始化模式，仅 initConfigFrom 非空时生效 */
  initMode?: 'SKIP_EXISTING' | 'UPSERT'
}

export interface BatchCreateTenantsResponse {
  tenants: Tenant[]
  /** 配置初始化结果，未传 initConfigFrom 时为 null */
  configInit: TenantConfigBatchInitResponse | null
}

export interface TenantConfigBatchInitResponse {
  batchOperationId: string
  totalTenants: number
  successTenants: number
  failureTenants: number
  dryRun: boolean
  results: TenantConfigInitResult[]
}

export interface TenantConfigInitResult {
  tenantId: string
  success: boolean
  errorMessage?: string
  jobDefinitions?: ConfigInitItemStats
  workflowDefinitions?: ConfigInitItemStats
  pipelineDefinitions?: ConfigInitItemStats
  fileChannels?: ConfigInitItemStats
  fileTemplates?: ConfigInitItemStats
  resourceQueues?: ConfigInitItemStats
  batchWindows?: ConfigInitItemStats
  businessCalendars?: ConfigInitItemStats
  quotaPolicies?: ConfigInitItemStats
  alertRoutings?: ConfigInitItemStats
}

export interface ConfigInitItemStats {
  created: number
  updated: number
  skipped: number
  failed: number
  details?: { code?: string; action: string; errorMessage?: string }[]
}

export interface UpdateTenantRequest {
  tenantName: string
  description?: string
}

/** GET /api/console/tenants */
export function listTenants(query: TenantListQuery = {}) {
  return get<TenantPage>('/api/console/tenants', query)
}

/** GET /api/console/tenants/{tenantId} */
export function getTenant(tenantId: string) {
  return get<Tenant>(`/api/console/tenants/${encodeURIComponent(tenantId)}`)
}

/** POST /api/console/tenants */
export function createTenant(body: CreateTenantRequest) {
  return post<Tenant>('/api/console/tenants', body)
}

/** PUT /api/console/tenants/{tenantId} */
export function updateTenant(tenantId: string, body: UpdateTenantRequest) {
  return put<Tenant>(`/api/console/tenants/${encodeURIComponent(tenantId)}`, body)
}

/** POST /api/console/tenants/batch */
export function batchCreateTenants(body: BatchCreateTenantsRequest) {
  return post<BatchCreateTenantsResponse>('/api/console/tenants/batch', body)
}

/** POST /api/console/tenants/{tenantId}/suspend */
export function suspendTenant(tenantId: string) {
  return post<Tenant>(`/api/console/tenants/${encodeURIComponent(tenantId)}/suspend`)
}

/** POST /api/console/tenants/{tenantId}/activate */
export function activateTenant(tenantId: string) {
  return post<Tenant>(`/api/console/tenants/${encodeURIComponent(tenantId)}/activate`)
}
