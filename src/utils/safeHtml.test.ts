import { describe, it, expect, vi, beforeEach } from 'vitest'

// 这里只 mock DOMPurify,不起用被测契约之外的正则清洗实现 —— 白名单和标签过滤由 DOMPurify
// 自己负责(已有独立测试),本文件只验证 purifyHtml 是否把内容和显式限制交给了它。
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((input: string) => input),
  },
}))

import DOMPurify from 'dompurify'
import { purifyHtml } from './safeHtml'

const mockedSanitize = vi.mocked(DOMPurify.sanitize)

describe('purifyHtml', () => {
  beforeEach(() => {
    mockedSanitize.mockClear()
  })

  it('returns empty string for null / undefined', () => {
    expect(purifyHtml(null)).toBe('')
    expect(purifyHtml(undefined)).toBe('')
    expect(mockedSanitize).not.toHaveBeenCalled()
  })

  it('coerces non-string input to string before sanitizing', () => {
    expect(purifyHtml(42)).toBe('42')
    expect(purifyHtml({ toString: () => '<b>x</b>' })).toBe('<b>x</b>')
    expect(mockedSanitize).toHaveBeenNthCalledWith(1, '42', expect.any(Object))
  })

  it('forwards content to DOMPurify with explicit tag and attribute restrictions', () => {
    const raw = '<div>ok</div><script>alert(1)</script>'
    purifyHtml(raw)
    expect(mockedSanitize).toHaveBeenCalledWith(raw, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    })
  })

  it('returns the sanitized string unchanged', () => {
    expect(purifyHtml('<b>bold</b>')).toBe('<b>bold</b>')
  })
})
