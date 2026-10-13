import { describe, expect, it } from 'vitest'
import type { DesignerEdge, DesignerNode, DesignerNodeType } from '../types'
import { resolveAutomaticPlacement } from './automaticConnection'

function node(id: string, nodeType: DesignerNodeType): DesignerNode {
  return { id, nodeCode: id, nodeName: id, nodeType, x: 0, y: 0 }
}

function edge(id: string, source: string, target: string): DesignerEdge {
  return { id, source, target, attrs: { edgeType: 'SUCCESS', enabled: true } }
}

describe('resolveAutomaticPlacement', () => {
  it('builds a linear workflow by appending after the selected node', () => {
    expect(
      resolveAutomaticPlacement([node('start', 'START')], [], new Set(['start']), 'JOB'),
    ).toEqual({ ok: true, placement: { kind: 'append', sourceId: 'start' } })
  })

  it('inserts a business node into a selected dependency edge', () => {
    expect(
      resolveAutomaticPlacement(
        [node('start', 'START'), node('end', 'END')],
        [edge('start-end', 'start', 'end')],
        new Set(['start-end']),
        'JOB',
      ),
    ).toEqual({ ok: true, placement: { kind: 'insert', edgeId: 'start-end' } })
  })

  it('never guesses an insertion point in a branched graph', () => {
    const result = resolveAutomaticPlacement(
      [node('start', 'START'), node('left', 'JOB'), node('right', 'JOB')],
      [edge('a', 'start', 'left'), edge('b', 'start', 'right')],
      new Set(),
      'JOB',
    )
    expect(result).toEqual({ ok: false, reason: 'selectInsertionPoint' })
  })

  it('blocks topology-invalid terminal placement', () => {
    expect(resolveAutomaticPlacement([node('end', 'END')], [], new Set(['end']), 'JOB')).toEqual({
      ok: false,
      reason: 'cannotAppendAfterEnd',
    })
    expect(
      resolveAutomaticPlacement(
        [node('start', 'START'), node('job', 'JOB')],
        [edge('a', 'start', 'job')],
        new Set(['a']),
        'END',
      ),
    ).toEqual({ ok: false, reason: 'cannotInsertTerminal' })
  })
})
