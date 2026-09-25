import type { DesignerEdge } from '../types'

export type DesignerEdgeType = 'SUCCESS' | 'FAILURE' | 'CONDITION' | 'ALWAYS'

const KNOWN_EDGE_TYPES = new Set<DesignerEdgeType>(['SUCCESS', 'FAILURE', 'CONDITION', 'ALWAYS'])

const EDGE_TONES: Record<DesignerEdgeType, string> = {
  SUCCESS: 'var(--color-success, #16a34a)',
  FAILURE: 'var(--color-danger, #dc2626)',
  CONDITION: 'var(--color-warning, #d97706)',
  ALWAYS: 'var(--color-primary, #1668e3)',
}

export function edgeTypeOf(edge: DesignerEdge): DesignerEdgeType {
  const raw = String(edge.attrs?.edgeType ?? 'SUCCESS').toUpperCase() as DesignerEdgeType
  return KNOWN_EDGE_TYPES.has(raw) ? raw : 'SUCCESS'
}

export function isEdgeEnabled(edge: DesignerEdge): boolean {
  return edge.attrs?.enabled !== false
}

function compactExpression(expression: string, maxLength = 36): string {
  const compact = expression.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1)}…`
}

export function edgeCanvasLabel(edge: DesignerEdge): string {
  const edgeType = edgeTypeOf(edge)
  const expression = edgeType === 'CONDITION' ? compactExpression(edge.label ?? '') : ''
  const semanticLabel = expression ? `${edgeType} · ${expression}` : edgeType
  if (!isEdgeEnabled(edge)) return `DISABLED · ${semanticLabel}`
  if (edgeType === 'CONDITION' || edgeType === 'FAILURE') return semanticLabel
  return ''
}

export function edgeCanvasAttrs(edge: DesignerEdge, hasError = false) {
  const enabled = isEdgeEnabled(edge)
  const edgeType = edgeTypeOf(edge)
  const tone = hasError
    ? 'var(--color-danger, #dc2626)'
    : enabled
      ? EDGE_TONES[edgeTypeOf(edge)]
      : 'var(--color-text-placeholder, #a8abb2)'

  return {
    line: {
      stroke: tone,
      strokeWidth: hasError ? 2.25 : 1.75,
      strokeDasharray:
        !enabled || edgeType === 'FAILURE' ? '6 4' : edgeType === 'CONDITION' ? '3 3' : '',
      opacity: enabled ? 1 : 0.65,
      vectorEffect: 'non-scaling-stroke',
      targetMarker: { name: 'block', size: 8, fill: tone, stroke: tone },
    },
    label: {
      text: {
        text: edgeCanvasLabel(edge),
        fill: tone,
        fontSize: 11,
        fontWeight: 600,
      },
      rect: {
        fill: 'var(--color-bg-card, #fff)',
        stroke: tone,
        strokeWidth: 1,
        rx: 3,
        ry: 3,
        refWidth: 1.18,
        refHeight: 1.5,
        refX: -0.09,
        refY: -0.25,
        opacity: enabled ? 0.96 : 0.82,
      },
    },
  }
}
