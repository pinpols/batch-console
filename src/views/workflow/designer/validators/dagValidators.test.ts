import { describe, it, expect } from 'vitest'
import { validateDag } from './dagValidators'
import type { DesignerSnapshot } from '../types'

function snap(
  nodes: Array<{ id: string; type: string; attrs?: Record<string, unknown> }>,
  edges: Array<[string, string]>,
): DesignerSnapshot {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeCode: n.id,
      nodeName: n.id,
      nodeType: n.type as never,
      x: 0,
      y: 0,
      attrs: n.attrs ?? {},
    })),
    edges: edges.map(([s, t], i) => ({ id: `e${i}`, source: s, target: t })),
  }
}

describe('validateDag', () => {
  it('R1 缺少 START → missingStart', () => {
    const errs = validateDag(snap([{ id: 'e', type: 'END' }], []))
    expect(errs.some((e) => e.messageKey.endsWith('.missingStart'))).toBe(true)
  })

  it('R1 多个 START → multipleStart + 标红', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's1', type: 'START' },
          { id: 's2', type: 'START' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s1', 'e'],
          ['s2', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.messageKey.endsWith('.multipleStart'))).toBe(true)
    expect(errs.filter((e) => e.messageKey.endsWith('.extraStart'))).toHaveLength(2)
  })

  it('R2 缺少 END', () => {
    const errs = validateDag(snap([{ id: 's', type: 'START' }], []))
    expect(errs.some((e) => e.messageKey.endsWith('.missingEnd'))).toBe(true)
  })

  it('R3 孤立节点 → unreachable', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'e', type: 'END' },
          { id: 'orphan', type: 'JOB', attrs: { jobCode: 'X' } },
        ],
        [['s', 'e']],
      ),
    )
    expect(errs.find((er) => er.nodeId === 'orphan' && er.messageKey.endsWith('.unreachable'))).toBeTruthy()
  })

  it('R4 检测到环 → cycle + 标红参与节点', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'a', type: 'JOB', attrs: { jobCode: 'A' } },
          { id: 'b', type: 'JOB', attrs: { jobCode: 'B' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'a'],
          ['a', 'b'],
          ['b', 'a'], // cycle
          ['a', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.messageKey.endsWith('.cycle'))).toBe(true)
    const flagged = errs.filter((e) => e.messageKey.endsWith('.cycleNode')).map((e) => e.nodeId)
    expect(flagged).toContain('a')
    expect(flagged).toContain('b')
  })

  it('R5 GATEWAY 出度 < 2', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'g', type: 'GATEWAY', attrs: { gatewayStrategy: 'AND' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'g'],
          ['g', 'e'],
        ],
      ),
    )
    expect(errs.some((e) => e.nodeId === 'g' && e.messageKey.endsWith('.gatewayOutDegree'))).toBe(true)
  })

  it('R6 JOB 缺 jobCode', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'j'],
          ['j', 'e'],
        ],
      ),
    )
    expect(
      errs.find(
        (e) =>
          e.nodeId === 'j' &&
          e.field === 'jobCode' &&
          e.messageKey.endsWith('.jobCodeRequired'),
      ),
    ).toBeTruthy()
  })

  it('R7 FILE_STEP 缺 pipelineCode', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'f', type: 'FILE_STEP' },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'f'],
          ['f', 'e'],
        ],
      ),
    )
    expect(
      errs.find((e) => e.nodeId === 'f' && e.field === 'pipelineCode'),
    ).toBeTruthy()
  })

  it('R8 GATEWAY strategy 必填(空 / 非法值)', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'g', type: 'GATEWAY', attrs: { gatewayStrategy: 'BOGUS' } },
          { id: 'e1', type: 'END' },
          { id: 'e2', type: 'END' },
        ],
        [
          ['s', 'g'],
          ['g', 'e1'],
          ['g', 'e2'],
        ],
      ),
    )
    expect(
      errs.find(
        (e) =>
          e.nodeId === 'g' &&
          e.field === 'gatewayStrategy' &&
          e.messageKey.endsWith('.gatewayStrategyRequired'),
      ),
    ).toBeTruthy()
  })

  it('合法线性 DAG → 无错误', () => {
    const errs = validateDag(
      snap(
        [
          { id: 's', type: 'START' },
          { id: 'j', type: 'JOB', attrs: { jobCode: 'X' } },
          { id: 'e', type: 'END' },
        ],
        [
          ['s', 'j'],
          ['j', 'e'],
        ],
      ),
    )
    expect(errs).toEqual([])
  })
})
