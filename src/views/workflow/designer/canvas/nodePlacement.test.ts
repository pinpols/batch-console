import { describe, expect, it } from 'vitest'
import type { DesignerNode } from '../types'
import { designerNodeSize, findVacantNodePosition } from './nodePlacement'

function node(id: string, nodeType: DesignerNode['nodeType'], x: number, y: number): DesignerNode {
  return { id, nodeCode: id, nodeName: id, nodeType, x, y }
}

function intersects(a: DesignerNode, b: DesignerNode) {
  const as = designerNodeSize(a.nodeType)
  const bs = designerNodeSize(b.nodeType)
  return !(
    a.x + as.width <= b.x ||
    b.x + bs.width <= a.x ||
    a.y + as.height <= b.y ||
    b.y + bs.height <= a.y
  )
}

describe('findVacantNodePosition', () => {
  it('lays out the common START -> JOB -> END sequence without overlap', () => {
    const center = { x: 400, y: 300 }
    const nodes: DesignerNode[] = []
    for (const [id, type] of [
      ['start', 'START'],
      ['job', 'JOB'],
      ['end', 'END'],
    ] as const) {
      const position = findVacantNodePosition(type, center, nodes)
      nodes.push(node(id, type, position.x, position.y))
    }

    expect(nodes[0]!.y).toBeLessThan(nodes[1]!.y)
    expect(nodes[1]!.y).toBeLessThan(nodes[2]!.y)
    expect(intersects(nodes[0]!, nodes[1]!)).toBe(false)
    expect(intersects(nodes[1]!, nodes[2]!)).toBe(false)
  })

  it('moves repeated task nodes into vacant lanes', () => {
    const center = { x: 400, y: 300 }
    const first = findVacantNodePosition('JOB', center, [])
    const existing = [node('job-1', 'JOB', first.x, first.y)]
    const second = findVacantNodePosition('JOB', center, existing)

    expect(second).not.toEqual(first)
    expect(intersects(existing[0]!, node('job-2', 'JOB', second.x, second.y))).toBe(false)
  })
})
