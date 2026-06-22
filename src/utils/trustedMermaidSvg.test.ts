// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { clearTrustedSvg, setTrustedMermaidSvg } from './trustedMermaidSvg'

describe('trustedMermaidSvg', () => {
  it('sanitizes Mermaid SVG before writing to innerHTML', () => {
    const el = document.createElement('div')

    setTrustedMermaidSvg(
      el,
      '<svg><g onclick="alert(1)"><a href="javascript:alert(2)"><text>node</text></a></g><script>alert(3)</script></svg>',
    )

    expect(el.innerHTML).toContain('<svg')
    expect(el.innerHTML).toContain('node')
    expect(el.innerHTML.toLowerCase()).not.toContain('<script')
    expect(el.innerHTML.toLowerCase()).not.toContain('onclick')
    expect(el.innerHTML.toLowerCase()).not.toContain('javascript:')
  })

  it('clears previously rendered SVG content', () => {
    const el = document.createElement('div')
    el.innerHTML = '<svg><text>old</text></svg>'

    clearTrustedSvg(el)

    expect(el.innerHTML).toBe('')
  })

  it('ignores empty element references', () => {
    expect(() => setTrustedMermaidSvg(null, '<svg />')).not.toThrow()
    expect(() => clearTrustedSvg(undefined)).not.toThrow()
  })
})
