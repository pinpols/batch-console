import { describe, it, expect } from 'vitest'
import { definitionToGraph } from './definitionToGraph'

describe('definitionToGraph', () => {
  it('empty / null definition → empty snapshot', () => {
    expect(definitionToGraph(null)).toEqual({ nodes: [], edges: [] })
    expect(definitionToGraph(undefined)).toEqual({ nodes: [], edges: [] })
    expect(definitionToGraph({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
  })

  it('single START node maps id = nodeCode and assigns fallback xy when missing', () => {
    const snap = definitionToGraph({
      nodes: [{ nodeCode: 's', nodeName: 'Start', nodeType: 'START' }],
      edges: [],
    })
    expect(snap.nodes).toHaveLength(1)
    expect(snap.nodes[0].id).toBe('s')
    expect(snap.nodes[0].nodeType).toBe('START')
    expect(typeof snap.nodes[0].x).toBe('number')
    expect(typeof snap.nodes[0].y).toBe('number')
  })

  it('linear DAG START → JOB → END produces 2 edges with source/target ids', () => {
    const snap = definitionToGraph({
      nodes: [
        { nodeCode: 's', nodeType: 'START', x: 0, y: 0 },
        { nodeCode: 'j', nodeType: 'JOB', x: 100, y: 0 },
        { nodeCode: 'e', nodeType: 'END', x: 200, y: 0 },
      ],
      edges: [
        { sourceNodeCode: 's', targetNodeCode: 'j' },
        { sourceNodeCode: 'j', targetNodeCode: 'e' },
      ],
    })
    expect(snap.nodes).toHaveLength(3)
    expect(snap.edges).toHaveLength(2)
    expect(snap.edges[0]).toMatchObject({ source: 's', target: 'j' })
    expect(snap.edges[1]).toMatchObject({ source: 'j', target: 'e' })
  })

  it('preserves edge execution attributes for a later full save', () => {
    const snap = definitionToGraph({
      nodes: [],
      edges: [
        {
          sourceNodeCode: 'gateway',
          targetNodeCode: 'fallback',
          label: 'onFailure',
          edgeType: 'FAILURE',
          enabled: false,
        },
      ],
    })

    expect(snap.edges[0]).toMatchObject({
      source: 'gateway',
      target: 'fallback',
      label: 'onFailure',
      attrs: { edgeType: 'FAILURE', enabled: false },
    })
  })

  it('GATEWAY node normalizes type and preserves passthrough attrs', () => {
    const snap = definitionToGraph({
      nodes: [
        { nodeCode: 'g', nodeType: 'GATEWAY', gatewayStrategy: 'XOR' },
        { nodeCode: 'x', nodeType: 'unknown-type' },
      ],
      edges: [],
    })
    expect(snap.nodes[0].nodeType).toBe('GATEWAY')
    expect(snap.nodes[0].attrs?.gatewayStrategy).toBe('XOR')
    // 未知节点类型回退到 JOB(Spike 阶段渲染为通用矩形)
    expect(snap.nodes[1].nodeType).toBe('JOB')
  })
})
