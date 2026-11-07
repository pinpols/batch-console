import { describe, expect, it } from 'vitest'
import { expandSvgViewBoxToContent } from './expandSvgViewBox'

function fakeSvg(options?: { box?: Partial<DOMRect>; throws?: boolean; bbox?: boolean }) {
  const attrs = new Map<string, string>()
  const svg = {
    setAttribute(name: string, value: string) {
      attrs.set(name, value)
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null
    },
  } as SVGSVGElement
  if (options?.bbox !== false) {
    svg.getBBox = () => {
      if (options?.throws) throw new Error('not rendered')
      return { x: 2, y: -10, width: 80, height: 30, ...options?.box } as DOMRect
    }
  }
  return svg
}

describe('expandSvgViewBoxToContent', () => {
  it('把 viewBox 扩到包围盒并留出边距', () => {
    const svg = fakeSvg()
    expandSvgViewBoxToContent(svg)
    expect(svg.getAttribute('viewBox')).toBe('-14 -26 112 62')
  })

  it('包围盒为空时保留原来的 viewBox', () => {
    const svg = fakeSvg({ box: { width: 0, height: 0 } })
    expandSvgViewBoxToContent(svg)
    expect(svg.getAttribute('viewBox')).toBeNull()
  })

  it('getBBox 抛错时保留原来的 viewBox', () => {
    const svg = fakeSvg({ throws: true })
    expandSvgViewBoxToContent(svg)
    expect(svg.getAttribute('viewBox')).toBeNull()
  })
})
