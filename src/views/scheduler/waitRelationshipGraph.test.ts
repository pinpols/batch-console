import { describe, expect, it } from 'vitest'
import { dependencySnapshotText } from './dependencyWaitsPresentation'
import { relationshipDependencies } from './waitRelationshipGraph'

describe('wait relationship dependencies', () => {
  it('reads structured calendar and job snapshots without object placeholders', () => {
    expect(
      relationshipDependencies('CALENDAR', '[{"upstreamCode":"BANK","rule":"SAME_DAY"}]'),
    ).toEqual({ codes: ['BANK'], unknown: false })
    expect(
      relationshipDependencies(
        'JOB',
        '[{"upstreamJobCode":"EXTRACT","upstreamBizDate":"2026-11-01"}]',
      ),
    ).toEqual({ codes: ['EXTRACT (2026-11-01)'], unknown: false })
    expect(dependencySnapshotText('[{"upstreamCode":"BANK","rule":"SAME_DAY"}]')).toContain('BANK')
    expect(dependencySnapshotText('[{"upstreamCode":"BANK","rule":"SAME_DAY"}]')).not.toContain(
      '[object Object]',
    )
  })

  it('shows readiness codes and marks unsupported snapshots instead of inventing edges', () => {
    expect(relationshipDependencies('READINESS', 'A, B')).toEqual({
      codes: ['A', 'B'],
      unknown: false,
    })
    expect(relationshipDependencies('CAPACITY_ADMISSION', null)).toEqual({
      codes: [],
      unknown: false,
    })
    expect(relationshipDependencies('JOB', '[{"unexpected":"A"}]')).toEqual({
      codes: [],
      unknown: true,
    })
    expect(relationshipDependencies('JOB', '{invalid')).toEqual({ codes: [], unknown: true })
  })
})

import type { WaitRelationship } from '@/api/dependencyWaits'
import { buildWaitTopology, waitTopologyMermaid } from './waitRelationshipGraph'

function wait(
  kind: WaitRelationship['waitType'],
  id: string,
  code: string,
  date: string,
  snapshot: string | null,
): WaitRelationship {
  return {
    id,
    waitType: kind,
    tenantId: 'tenant-a',
    subjectCode: code,
    bizDate: date,
    waitStatus: 'WAITING',
    dependencySnapshot: snapshot,
    dependencySnapshotValid: true,
    updatedAt: '2026-11-01T00:00:00Z',
  }
}
const jobSnapshot = (code: string, alignment = 'SAME_DAY', date?: string) =>
  JSON.stringify([{ upstreamJobCode: code, bizDateAlignment: alignment, upstreamBizDate: date }])

describe('connected wait topology', () => {
  it('joins an A to B to C chain using the same tenant, job code and date', () => {
    const result = buildWaitTopology([
      wait('JOB', '1', 'B', '2026-11-01', jobSnapshot('A')),
      wait('JOB', '2', 'C', '2026-11-01', jobSnapshot('B')),
    ])
    const labels = new Map(result.nodes.map((node) => [node.key, node.code]))
    expect(result.nodes.map((node) => node.code)).toEqual(['B', 'A', 'C'])
    expect(result.edges.map((edge) => [labels.get(edge.from), labels.get(edge.to)])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ])
    expect(result.unresolved).toBe(0)
  })

  it('deduplicates actual wait statuses and leaves upstream status unspecified', () => {
    const first = wait('JOB', '1', 'B', '2026-11-01', jobSnapshot('A'))
    const result = buildWaitTopology([
      first,
      { ...first, id: '2', waitStatus: 'RELEASED' },
      { ...first, id: '3' },
    ])
    const subject = result.nodes.find((node) => node.code === 'B')!
    const upstream = result.nodes.find((node) => node.code === 'A')!
    expect(subject.waitCount).toBe(3)
    expect(subject.statuses).toEqual(['WAITING', 'RELEASED'])
    expect(subject.missingStatus).toBe(false)
    expect(upstream.waitCount).toBe(0)
    expect(upstream.statuses).toEqual([])
  })

  it('keeps entity types, tenants, dates and separate Workflow waits distinct', () => {
    const first = wait('JOB', '1', 'B', '2026-11-01', jobSnapshot('A'))
    const result = buildWaitTopology([
      first,
      wait('JOB', '2', 'C', '2026-11-02', jobSnapshot('B', 'PREVIOUS_BIZ_DAY', '2026-11-01')),
      wait('CALENDAR', '3', 'B', '2026-11-01', '[{"upstreamCode":"A","rule":"WAIT_SETTLED"}]'),
      { ...first, id: '4', tenantId: 'tenant-b' },
      wait('READINESS', '5', 'WF', '2026-11-01', 'B'),
      wait('READINESS', '6', 'WF', '2026-11-01', 'B'),
      wait('CAPACITY_ADMISSION', '7', 'WF', '2026-11-01', null),
    ])
    expect(result.nodes.filter((node) => node.code === 'B')).toHaveLength(3)
    expect(result.nodes.filter((node) => node.code === 'WF')).toHaveLength(3)
    const firstB = result.nodes.find((node) => node.kind === 'JOB' && node.code === 'B')!
    const c = result.nodes.find((node) => node.code === 'C')!
    expect(result.edges).toContainEqual({ from: firstB.key, to: c.key })
    const capacity = result.nodes.find((node) => node.kind === 'CAPACITY_ADMISSION')!
    expect(
      result.edges.some((edge) => edge.from === capacity.key || edge.to === capacity.key),
    ).toBe(false)
  })

  it('reports unknown dates and invalid snapshots without inventing an edge', () => {
    const result = buildWaitTopology([
      wait('JOB', '1', 'B', '2026-11-01', jobSnapshot('A', 'PREVIOUS_BIZ_DAY')),
      { ...wait('JOB', '2', 'C', '2026-11-01', jobSnapshot('B')), dependencySnapshotValid: false },
    ])
    expect(result.unresolved).toBe(2)
    expect(result.edges).toEqual([])
    expect(result.nodes.map((node) => node.code)).toEqual(['B', 'C'])
  })

  it('stops graph generation at a safe size and escapes untrusted labels', () => {
    const tooLarge = buildWaitTopology(
      Array.from({ length: 151 }, (_, i) =>
        wait('CAPACITY_ADMISSION', String(i), 'WF', '2026-11-01', null),
      ),
    )
    expect(tooLarge.tooLarge).toBe(true)
    const small = buildWaitTopology([wait('CAPACITY_ADMISSION', '1', 'WF', '2026-11-01', null)])
    const mermaid = waitTopologyMermaid(small, () => 'x"] --> malicious["y\n#quot;<script>')
    expect(mermaid).not.toContain('\n#quot;')
    expect(mermaid).toContain('#34;')
    expect(mermaid).toContain('#35;quot;')
    expect(mermaid.split('\n')).toHaveLength(2)
  })
})
