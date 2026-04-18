import { describe, it, expect, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((input: string, _opts: unknown) =>
      input.replace(/<script.*?>.*?<\/script>/gi, ''),
    ),
  },
}))

import { purifyHtml } from './safeHtml'

describe('purifyHtml', () => {
  it('returns empty string for null / undefined', () => {
    expect(purifyHtml(null)).toBe('')
    expect(purifyHtml(undefined)).toBe('')
  })

  it('coerces non-string input to string before sanitizing', () => {
    expect(purifyHtml(42)).toBe('42')
    expect(purifyHtml({ toString: () => '<b>x</b>' })).toBe('<b>x</b>')
  })

  it('strips obvious <script> payloads via DOMPurify', () => {
    const raw = '<div>ok</div><script>alert(1)</script>'
    expect(purifyHtml(raw)).toBe('<div>ok</div>')
  })

  it('returns sanitized string unchanged when it has no dangerous parts', () => {
    expect(purifyHtml('<b>bold</b>')).toBe('<b>bold</b>')
  })
})
