import { describe, expect, it } from 'vitest'
import { edgeCanvasAttrs, edgeCanvasLabel, edgeTypeOf, isEdgeEnabled } from './edgePresentation'
import type { DesignerEdge } from '../types'

function edge(attrs: Record<string, unknown> = {}, label?: string): DesignerEdge {
  return { id: 'edge-1', source: 'upstream', target: 'downstream', attrs, label }
}

describe('edgePresentation', () => {
  it('defaults legacy edges to enabled SUCCESS semantics', () => {
    const value = edge()
    expect(edgeTypeOf(value)).toBe('SUCCESS')
    expect(isEdgeEnabled(value)).toBe(true)
    expect(edgeCanvasLabel(value)).toBe('')
  })

  it('shows a compact CONDITION expression on the canvas', () => {
    const value = edge(
      { edgeType: 'CONDITION', enabled: true },
      'amount >= 10000   && currency == "CNY" && customer.status == "ACTIVE"',
    )
    expect(edgeCanvasLabel(value)).toMatch(/^CONDITION · amount >= 10000 && currency/)
    expect(edgeCanvasLabel(value).endsWith('…')).toBe(true)
  })

  it('marks disabled dependencies with both text and dashed styling', () => {
    const value = edge({ edgeType: 'FAILURE', enabled: false })
    expect(edgeCanvasLabel(value)).toBe('DISABLED · FAILURE')
    expect(edgeCanvasAttrs(value).line).toMatchObject({ strokeDasharray: '6 4', opacity: 0.65 })
  })

  it('uses error styling without losing the edge type label', () => {
    const value = edge({ edgeType: 'CONDITION', enabled: true })
    const presentation = edgeCanvasAttrs(value, true)
    expect(presentation.label.text.text).toBe('CONDITION')
    expect(presentation.line.stroke).toContain('--color-danger')
  })
})
