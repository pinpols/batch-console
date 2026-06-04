/**
 * diffAlgorithm — added / removed / modified 三类 case + summary 统计。
 */
import { describe, it, expect } from 'vitest'
import { diffDefinitions, statusOfNodeInSide } from './diffAlgorithm'

describe('diffDefinitions', () => {
  it('detects added nodes & edges (from empty → to with content)', () => {
    const from = { nodes: [], edges: [] }
    const to = {
      nodes: [
        { nodeCode: 'a', nodeType: 'START' },
        { nodeCode: 'b', nodeType: 'JOB' },
      ],
      edges: [{ sourceNodeCode: 'a', targetNodeCode: 'b' }],
    }
    const d = diffDefinitions(from, to)
    expect(d.summary.added).toBe(3) // 2 nodes + 1 edge
    expect(d.summary.removed).toBe(0)
    expect(d.summary.modified).toBe(0)
    expect(d.nodes.find((n) => n.nodeCode === 'a')?.status).toBe('added')
    expect(statusOfNodeInSide(d, 'b', 'to')).toBe('added')
    // added 节点在 from 侧应被视为 unchanged(避免错误高亮)
    expect(statusOfNodeInSide(d, 'b', 'from')).toBe('unchanged')
  })

  it('detects removed nodes (from has them, to does not)', () => {
    const from = {
      nodes: [
        { nodeCode: 'a', nodeType: 'START' },
        { nodeCode: 'b', nodeType: 'JOB' },
      ],
      edges: [{ sourceNodeCode: 'a', targetNodeCode: 'b' }],
    }
    const to = { nodes: [{ nodeCode: 'a', nodeType: 'START' }], edges: [] }
    const d = diffDefinitions(from, to)
    expect(d.summary.removed).toBe(2) // 1 node(b) + 1 edge
    expect(d.summary.added).toBe(0)
    expect(d.nodes.find((n) => n.nodeCode === 'b')?.status).toBe('removed')
    expect(statusOfNodeInSide(d, 'b', 'from')).toBe('removed')
    expect(statusOfNodeInSide(d, 'b', 'to')).toBe('unchanged')
  })

  it('detects modified nodes when nodeType / nodeName / attrs differ (ignoring x/y)', () => {
    const from = {
      nodes: [
        { nodeCode: 'a', nodeName: 'Hello', nodeType: 'JOB', jobCode: 'old', x: 0, y: 0 },
      ],
      edges: [],
    }
    const to = {
      nodes: [
        { nodeCode: 'a', nodeName: 'Hello', nodeType: 'JOB', jobCode: 'new', x: 99, y: 99 },
      ],
      edges: [],
    }
    const d = diffDefinitions(from, to)
    expect(d.summary.modified).toBe(1)
    expect(d.summary.unchanged).toBe(0)
    expect(d.nodes[0].status).toBe('modified')

    // pure x/y 移动 → unchanged
    const d2 = diffDefinitions(
      {
        nodes: [{ nodeCode: 'a', nodeType: 'JOB', x: 0, y: 0 }],
        edges: [],
      },
      {
        nodes: [{ nodeCode: 'a', nodeType: 'JOB', x: 500, y: 500 }],
        edges: [],
      },
    )
    expect(d2.summary.modified).toBe(0)
    expect(d2.summary.unchanged).toBe(1)
  })
})
