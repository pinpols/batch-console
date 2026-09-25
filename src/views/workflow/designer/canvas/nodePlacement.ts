import type { DesignerNode, DesignerNodeType } from '../types'

export interface CanvasPoint {
  x: number
  y: number
}

interface NodeSize {
  width: number
  height: number
}

const DEFAULT_NODE_SIZE: NodeSize = { width: 140, height: 60 }
const NODE_GAP = 28

export function designerNodeSize(type: DesignerNodeType): NodeSize {
  if (type === 'START' || type === 'END') return { width: 60, height: 60 }
  if (type === 'GATEWAY') return { width: 80, height: 80 }
  return DEFAULT_NODE_SIZE
}

function candidateOffsets(type: DesignerNodeType): CanvasPoint[] {
  const preferred =
    type === 'START' ? [{ x: 0, y: -180 }] : type === 'END' ? [{ x: 0, y: 180 }] : [{ x: 0, y: 0 }]

  const fallback: CanvasPoint[] = []
  const stepX = 190
  const stepY = 130
  for (let ring = 1; ring <= 8; ring += 1) {
    fallback.push(
      { x: -stepX * ring, y: 0 },
      { x: stepX * ring, y: 0 },
      { x: 0, y: -stepY * ring },
      { x: 0, y: stepY * ring },
      { x: -stepX * ring, y: -stepY * ring },
      { x: stepX * ring, y: stepY * ring },
    )
  }
  return [...preferred, ...fallback]
}

function overlaps(point: CanvasPoint, size: NodeSize, existing: DesignerNode): boolean {
  const other = designerNodeSize(existing.nodeType)
  return !(
    point.x + size.width + NODE_GAP <= existing.x ||
    existing.x + other.width + NODE_GAP <= point.x ||
    point.y + size.height + NODE_GAP <= existing.y ||
    existing.y + other.height + NODE_GAP <= point.y
  )
}

/**
 * Returns a top-left graph coordinate near the viewport center without covering an existing node.
 * START and END prefer the top/bottom lanes so the common START -> JOB -> END path is usable
 * immediately, while repeated task nodes spread horizontally before moving to another row.
 */
export function findVacantNodePosition(
  type: DesignerNodeType,
  center: CanvasPoint,
  existingNodes: DesignerNode[],
): CanvasPoint {
  const size = designerNodeSize(type)
  for (const offset of candidateOffsets(type)) {
    const point = {
      x: Math.round(center.x + offset.x - size.width / 2),
      y: Math.round(center.y + offset.y - size.height / 2),
    }
    if (existingNodes.every((node) => !overlaps(point, size, node))) return point
  }

  return {
    x: Math.round(center.x - size.width / 2),
    y: Math.round(center.y + existingNodes.length * 110 - size.height / 2),
  }
}
