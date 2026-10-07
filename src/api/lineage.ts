import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type AssetPartitionReadiness = components['schemas']['AssetPartitionReadiness']

// 证据行使用后端固定投影的生成类型，仅文件 metadata 保留动态 JSON。
export type LineageCoverage = components['schemas']['LineageCoverage']
export type LineageEvidence = components['schemas']['LineageEvidenceResponse']

export function getLineageEvidenceByResultVersion(id: number, tenantId: string) {
  return get<LineageEvidence>(`/api/console/lineage/result-versions/${id}`, { tenantId })
}

export function getLineageEvidenceByBusinessKey(businessKey: string, tenantId: string) {
  return get<LineageEvidence>('/api/console/lineage/effective', { tenantId, businessKey })
}

export function getAssetPartitionReadiness(query: {
  tenantId: string
  jobCode: string
  bizDate: string
}) {
  return get<AssetPartitionReadiness>('/api/console/asset-partitions/readiness', query)
}
