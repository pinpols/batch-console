// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { DirectiveBinding } from 'vue'
import { safeHtmlDirective } from './safeHtml'

function makeEl(): HTMLDivElement {
  return document.createElement('div')
}

function bind(value: unknown, oldValue?: unknown): DirectiveBinding {
  return { value, oldValue } as DirectiveBinding
}

describe('v-safe-html directive', () => {
  it('renders allowed tags as is', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('<b>hi</b>'), null as never, null)
    expect(el.innerHTML).toContain('<b>hi</b>')
  })

  it('strips <script> tags (DOMPurify)', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('x<script>alert(1)</script>y'), null as never, null)
    expect(el.innerHTML).not.toContain('<script')
    expect(el.innerHTML).toContain('x')
    expect(el.innerHTML).toContain('y')
  })

  it('strips event handlers (onclick / onerror)', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(
      el,
      bind('<img src=x onerror="alert(1)"><a onclick="alert(2)">k</a>'),
      null as never,
      null,
    )
    expect(el.innerHTML.toLowerCase()).not.toContain('onerror')
    expect(el.innerHTML.toLowerCase()).not.toContain('onclick')
  })

  it('strips javascript: URL', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('<a href="javascript:alert(1)">x</a>'), null as never, null)
    expect(el.innerHTML.toLowerCase()).not.toContain('javascript:')
  })

  it('handles null/undefined gracefully', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind(null), null as never, null)
    expect(el.innerHTML).toBe('')
  })

  it('updates on value change', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('<i>one</i>'), null as never, null)
    safeHtmlDirective.updated!(el, bind('<i>two</i>', '<i>one</i>'), null as never, null)
    expect(el.innerHTML).toContain('two')
    expect(el.innerHTML).not.toContain('one')
  })

  it('updated is no-op when value unchanged', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('<i>x</i>'), null as never, null)
    const before = el.innerHTML
    // 同值传入,不应重渲(避免无意义 DOM 操作)
    safeHtmlDirective.updated!(el, bind('<i>x</i>', '<i>x</i>'), null as never, null)
    expect(el.innerHTML).toBe(before)
  })

  it('clears innerHTML on unmount', () => {
    const el = makeEl()
    safeHtmlDirective.mounted!(el, bind('<span>z</span>'), null as never, null)
    safeHtmlDirective.beforeUnmount!(el, bind('<span>z</span>'), null as never, null)
    expect(el.innerHTML).toBe('')
  })
})
