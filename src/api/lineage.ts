import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type AssetPartitionReadiness = components['schemas']['AssetPartitionReadiness']

export interface LineageCoverage {
  scope?: string
  resultVersionId?: number
  sources?: Record<string, string>
  jobInstanceFound?: boolean
  payloadFileId?: number | null
  payloadFileResolved?: boolean
  pipelineInstanceCount?: number
  fileRecordCount?: number
  dispatchRecordCount?: number
  knownGaps?: string[]
}

export interface LineageEvidence {
  resultVersion?: Record<string, unknown>
  jobInstance?: Record<string, unknown> | null
  pipelineInstances?: Record<string, unknown>[]
  fileRecords?: Record<string, unknown>[]
  dispatchRecords?: Record<string, unknown>[]
  coverage?: LineageCoverage
}

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
