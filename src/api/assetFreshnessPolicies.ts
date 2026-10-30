import { get, patch, post, put } from '@/api/client'
import type { components } from '@/types/api.generated'

export type AssetFreshnessPolicy = components['schemas']['AssetFreshnessPolicy']
export type AssetFreshnessPolicyUpsertRequest =
  components['schemas']['AssetFreshnessPolicyUpsertRequest']
export type AssetFreshnessPolicyToggleRequest =
  components['schemas']['AssetFreshnessPolicyToggleRequest']
export type AssetFreshnessPolicyPage = components['schemas']['AssetFreshnessPolicyPageResponse']

export interface AssetFreshnessPolicyQuery {
  tenantId: string
  assetCode?: string
  enabled?: boolean
  pageNo: number
  pageSize: number
}

export function listAssetFreshnessPolicies(query: AssetFreshnessPolicyQuery) {
  const tenantId = query.tenantId
  const trimmedAssetCodeForCheck = query.assetCode?.trim()
  const assetCodeParams = trimmedAssetCodeForCheck
    ? { assetCode: query.assetCode!.trim() }
    : {}
  return get<AssetFreshnessPolicyPage>('/api/console/asset-freshness-policies', {
    tenantId,
    ...assetCodeParams,
    ...(query.enabled != null ? { enabled: query.enabled } : {}),
    pageNo: query.pageNo,
    pageSize: query.pageSize,
  })
}

export function getAssetFreshnessPolicy(id: number, tenantId: string) {
  return get<AssetFreshnessPolicy>(`/api/console/asset-freshness-policies/${id}`, { tenantId })
}

export function createAssetFreshnessPolicy(
  tenantId: string,
  body: AssetFreshnessPolicyUpsertRequest,
) {
  return post<void>('/api/console/asset-freshness-policies', body, { params: { tenantId } })
}

export function updateAssetFreshnessPolicy(
  id: number,
  tenantId: string,
  body: AssetFreshnessPolicyUpsertRequest,
) {
  return put<void>(`/api/console/asset-freshness-policies/${id}`, body, { params: { tenantId } })
}

export function toggleAssetFreshnessPolicy(
  id: number,
  tenantId: string,
  body: AssetFreshnessPolicyToggleRequest,
) {
  return patch<void>(`/api/console/asset-freshness-policies/${id}/enabled`, body, {
    params: { tenantId },
  })
}
