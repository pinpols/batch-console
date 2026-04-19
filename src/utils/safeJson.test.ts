import { describe, it, expect } from 'vitest'
import { safeParseJson } from './safeJson'

describe('safeParseJson', () => {
  it('keeps safe-range numbers as number', () => {
    const out = safeParseJson('{"id":42,"count":999999}') as Record<string, unknown>
    expect(typeof out.id).toBe('number')
    expect(out.id).toBe(42)
    expect(typeof out.count).toBe('number')
    expect(out.count).toBe(999999)
  })

  it('converts numbers > 2^53 to string (lossless)', () => {
    // 9007199254740993 = 2^53 + 1，原生 JSON.parse 会读成 9007199254740992（错位 -1）
    const raw = '{"id":9007199254740993}'
    const out = safeParseJson(raw) as { id: string }
    expect(typeof out.id).toBe('string')
    expect(out.id).toBe('9007199254740993')

    // 对照：原生 parse 一定失真
    const nativeLoss = JSON.parse(raw).id
    expect(nativeLoss).toBe(9007199254740992)
    expect(String(nativeLoss)).not.toBe('9007199254740993')
  })

  it('handles arrays with mixed sized numbers', () => {
    const out = safeParseJson('[1, 9007199254740993, "text"]') as unknown[]
    expect(out[0]).toBe(1)
    expect(out[1]).toBe('9007199254740993')
    expect(out[2]).toBe('text')
  })

  it('returns non-string input unchanged', () => {
    const obj = { id: 1 }
    expect(safeParseJson(obj)).toBe(obj)
    expect(safeParseJson(null)).toBe(null)
    expect(safeParseJson(undefined)).toBe(undefined)
  })

  it('returns empty string unchanged', () => {
    expect(safeParseJson('')).toBe('')
    expect(safeParseJson('   ')).toBe('   ')
  })

  it('returns non-JSON string unchanged（兼容文本响应）', () => {
    expect(safeParseJson('plain text')).toBe('plain text')
    expect(safeParseJson('123 abc')).toBe('123 abc')
  })

  it('falls back to original string on malformed JSON', () => {
    const bad = '{"id":1,'
    expect(safeParseJson(bad)).toBe(bad)
  })

  it('parses nested structures with big ids', () => {
    const raw = '{"data":{"items":[{"id":18014398509481984,"name":"foo"}]}}'
    const out = safeParseJson(raw) as { data: { items: { id: string; name: string }[] } }
    expect(out.data.items[0].id).toBe('18014398509481984')
    expect(out.data.items[0].name).toBe('foo')
  })
})
