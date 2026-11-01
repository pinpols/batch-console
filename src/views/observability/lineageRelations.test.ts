import { describe, expect, it } from 'vitest'
import type { LineageEvidence } from '@/api/lineage'
import { buildLineageRelations } from './lineageRelations'

const evidence = {
  resultVersion: { id: 7, jobInstanceId: 42 },
  coverage: { resultVersionId: 7, payloadFileId: 88, payloadFileResolved: true },
  jobInstance: { id: 42, related_file_id: 88 },
  pipelineInstances: [{ id: 12, related_job_instance_id: 42, file_id: 88 }],
  fileRecords: [{ id: 88 }],
  dispatchRecords: [{ id: 99, file_id: 88, pipeline_instance_id: 12 }],
} as unknown as LineageEvidence

describe('buildLineageRelations', () => {
  it('connects only explicit matching references between returned records', () => {
    const result = buildLineageRelations(evidence)
    expect(result.relations).toEqual([
      { from: 'version:0', to: 'job:0', field: 'jobInstanceId' },
      { from: 'version:0', to: 'file:0', field: 'coverage.payloadFileId' },
      { from: 'job:0', to: 'file:0', field: 'related_file_id' },
      { from: 'pipeline:0', to: 'job:0', field: 'related_job_instance_id' },
      { from: 'pipeline:0', to: 'file:0', field: 'file_id' },
      { from: 'dispatch:0', to: 'pipeline:0', field: 'pipeline_instance_id' },
      { from: 'dispatch:0', to: 'file:0', field: 'file_id' },
    ])
  })

  it('does not attach payload coverage to a different result version', () => {
    const changed = {
      ...evidence,
      coverage: { ...evidence.coverage, resultVersionId: 8 },
    } as LineageEvidence
    expect(
      buildLineageRelations(changed).relations.some(
        (item) => item.field === 'coverage.payloadFileId',
      ),
    ).toBe(false)
  })

  it('does not connect missing, ambiguous, or imprecise identifiers', () => {
    const changed = {
      ...evidence,
      jobInstance: null,
      fileRecords: [{ id: 88 }, { id: 88 }],
      pipelineInstances: [{ id: 9007199254740992, file_id: 88 }],
      dispatchRecords: [{ id: 99, pipeline_instance_id: 9007199254740992, file_id: 88 }],
    } as unknown as LineageEvidence
    const result = buildLineageRelations(changed)
    expect(result.relations).toEqual([])
    expect(result.unresolved).toContainEqual({
      from: 'version:0',
      field: 'jobInstanceId',
      reference: '42',
      reason: 'targetMissing',
    })
    expect(result.unresolved).toContainEqual({
      from: 'dispatch:0',
      field: 'file_id',
      reference: '88',
      reason: 'ambiguous',
    })
    expect(result.unresolved).toContainEqual({
      from: 'dispatch:0',
      field: 'pipeline_instance_id',
      reference: null,
      reason: 'invalidId',
    })
  })
})
