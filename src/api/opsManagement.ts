import { get, put, del } from '@/api/client'

// ── biz 分片目录 shard-catalog(P2 tenant-routing 拓扑登记,平台 ADMIN)──────────────
// 后端:GET/PUT /api/console/ops/shard-catalog + DELETE /{placementKey}
// 只存位置不存账密(secretRef 仅凭据引用名);写 batch.business_shard_catalog(platform 库)。

export interface ShardCatalogRow {
  placementKey: string
  host: string
  port: number
  dbName: string
  secretRef: string
  poolMaxSize: number | null
  enabled: boolean
  description: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface ShardCatalogSavePayload {
  placementKey: string
  host: string
  port: number
  dbName: string
  secretRef: string
  poolMaxSize?: number | null
  enabled?: boolean
  description?: string | null
}

/** GET /api/console/ops/shard-catalog */
export function listShardCatalog() {
  return get<ShardCatalogRow[]>('/api/console/ops/shard-catalog')
}

/** PUT /api/console/ops/shard-catalog */
export function upsertShardCatalog(body: ShardCatalogSavePayload) {
  return put<void>('/api/console/ops/shard-catalog', body)
}

/** DELETE /api/console/ops/shard-catalog/{placementKey} */
export function deleteShardCatalog(placementKey: string) {
  return del<void>(`/api/console/ops/shard-catalog/${encodeURIComponent(placementKey)}`)
}

// ── biz 租户分片 placement(平台 ADMIN 跨租维护「哪个租户在哪片」)──────────────────
// 后端:GET/PUT /api/console/ops/tenant-placements + DELETE /{tenantId}
// 只存 tenant→placementKey 映射;写 batch.business_tenant_placement(platform 库)。
// placementKey 受 ^[a-z0-9-]+$ 约束;delete = 取消指派(回退 hash)。

export interface TenantPlacementRow {
  tenantId: string
  placementKey: string
  updatedAt: string | null
  updatedBy: string | null
}

export interface TenantPlacementSavePayload {
  tenantId: string
  placementKey: string
}

/** GET /api/console/ops/tenant-placements */
export function listTenantPlacements() {
  return get<TenantPlacementRow[]>('/api/console/ops/tenant-placements')
}

/** PUT /api/console/ops/tenant-placements */
export function upsertTenantPlacement(body: TenantPlacementSavePayload) {
  return put<void>('/api/console/ops/tenant-placements', body)
}

/** DELETE /api/console/ops/tenant-placements/{tenantId} */
export function deleteTenantPlacement(tenantId: string) {
  return del<void>(`/api/console/ops/tenant-placements/${encodeURIComponent(tenantId)}`)
}

/** placementKey 命名约束(与后端 `^[a-z0-9-]+$` 一致),前端表单校验复用。 */
export const PLACEMENT_KEY_PATTERN = /^[a-z0-9-]+$/
