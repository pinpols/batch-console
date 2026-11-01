import type { LineageEvidence } from '@/api/lineage'

type NodeType = 'version' | 'job' | 'pipeline' | 'file' | 'dispatch'
export interface LineageNode {
  key: string
  type: NodeType
  id: string | null
  data: unknown
}
export interface LineageRelation {
  from: string
  to: string
  field: string
}

// 不用已丢失精度的 JS 整数建立关系，避免把两个不同的 int64 当成同一对象。
function exactId(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : null
  return typeof value === 'string' && /^\d+$/.test(value) ? value : null
}

export function buildLineageRelations(evidence: LineageEvidence) {
  const nodes: LineageNode[] = []
  const relations: LineageRelation[] = []
  const unresolved: {
    from: string
    field: string
    reference: string | null
    reason: 'sourceUncertain' | 'missingField' | 'targetMissing' | 'ambiguous' | 'invalidId'
  }[] = []
  function add(type: NodeType, data: { id?: number | null } | null | undefined, index: number) {
    if (!data) return
    nodes.push({ key: `${type}:${index}`, type, id: exactId(data.id), data })
  }
  add('version', evidence.resultVersion, 0)
  add('job', evidence.jobInstance, 0)
  ;(evidence.pipelineInstances ?? []).forEach((item, index) => add('pipeline', item, index))
  ;(evidence.fileRecords ?? []).forEach((item, index) => add('file', item, index))
  ;(evidence.dispatchRecords ?? []).forEach((item, index) => add('dispatch', item, index))

  function connect(from: string, targetType: NodeType, field: string, rawId: unknown) {
    const source = nodes.find((node) => node.key === from)
    if (!source) return
    const id = exactId(rawId)
    if (rawId == null || rawId === '') {
      unresolved.push({ from, field, reference: null, reason: 'missingField' })
      return
    }
    if (id === null) {
      unresolved.push({ from, field, reference: null, reason: 'invalidId' })
      return
    }
    if (
      source.id === null ||
      nodes.filter((node) => node.type === source.type && node.id === source.id).length !== 1
    ) {
      unresolved.push({ from, field, reference: id, reason: 'sourceUncertain' })
      return
    }
    const matches = nodes.filter((node) => node.type === targetType && node.id === id)
    if (matches.length !== 1) {
      unresolved.push({
        from,
        field,
        reference: id,
        reason: matches.length ? 'ambiguous' : 'targetMissing',
      })
      return
    }
    relations.push({ from, to: matches[0].key, field })
  }
  if (evidence.resultVersion)
    connect('version:0', 'job', 'jobInstanceId', evidence.resultVersion.jobInstanceId)
  const versionId = exactId(evidence.resultVersion?.id)
  const coverageVersionId = exactId(evidence.coverage?.resultVersionId)
  if (versionId && versionId === coverageVersionId && evidence.coverage?.payloadFileResolved) {
    connect('version:0', 'file', 'coverage.payloadFileId', evidence.coverage.payloadFileId)
  }
  if (evidence.jobInstance)
    connect('job:0', 'file', 'related_file_id', evidence.jobInstance.related_file_id)
  ;(evidence.pipelineInstances ?? []).forEach((item, index) => {
    connect(`pipeline:${index}`, 'job', 'related_job_instance_id', item.related_job_instance_id)
    connect(`pipeline:${index}`, 'file', 'file_id', item.file_id)
  })
  ;(evidence.dispatchRecords ?? []).forEach((item, index) => {
    connect(`dispatch:${index}`, 'pipeline', 'pipeline_instance_id', item.pipeline_instance_id)
    connect(`dispatch:${index}`, 'file', 'file_id', item.file_id)
  })
  return { nodes, relations, unresolved }
}
