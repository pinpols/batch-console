import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type AssetPartitionReadiness = components['schemas']['AssetPartitionReadiness']

// 后端 #801-804 Map 收敛后已生成 LineageCoverage / LineageEvidenceResponse 真类型,
// 字段与此前手写 interface 逐一对齐,切到生成类型(重新生成:npm run gen:api)。
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
