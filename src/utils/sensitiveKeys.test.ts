import { describe, expect, it } from 'vitest'
import { detectSensitiveKeys, SENSITIVE_KEYWORDS } from './sensitiveKeys'

describe('detectSensitiveKeys', () => {
  it('returns empty for clean object', () => {
    expect(detectSensitiveKeys({ name: 'alice', count: 3 })).toEqual([])
  })

  it('detects direct sensitive keys', () => {
    expect(detectSensitiveKeys({ password: 'x', user: 'a' })).toEqual(['password'])
  })

  it('matches case- and separator-insensitive variants (api_key / apiKey / x-api-key)', () => {
    const hits = detectSensitiveKeys({
      api_key: 'a',
      apiKey: 'b',
      'X-API-KEY': 'c',
      ClientSecret: 'd',
    })
    expect(hits.sort()).toEqual(['ClientSecret', 'X-API-KEY', 'apiKey', 'api_key'].sort())
  })

  it('walks nested objects and returns dotted paths', () => {
    const hits = detectSensitiveKeys({
      db: { host: 'h', password: 'p' },
      meta: { nested: { token: 't' } },
    })
    expect(hits.sort()).toEqual(['db.password', 'meta.nested.token'])
  })

  it('walks arrays of objects with [i] index path', () => {
    const hits = detectSensitiveKeys({
      items: [{ ok: 1 }, { secret: 's' }, { inner: { accessKey: 'k' } }],
    })
    expect(hits.sort()).toEqual(['items[1].secret', 'items[2].inner.accessKey'])
  })

  it('parses JSON string input', () => {
    const hits = detectSensitiveKeys('{"foo":1,"privateKey":"x"}')
    expect(hits).toEqual(['privateKey'])
  })

  it('returns empty array for invalid / empty JSON string', () => {
    expect(detectSensitiveKeys('not json')).toEqual([])
    expect(detectSensitiveKeys('')).toEqual([])
    expect(detectSensitiveKeys('   ')).toEqual([])
  })

  it('returns empty for null / primitive input', () => {
    expect(detectSensitiveKeys(null)).toEqual([])
    expect(detectSensitiveKeys(42)).toEqual([])
    expect(detectSensitiveKeys(undefined)).toEqual([])
  })

  it('skips exempt path prefix (HTTP auth.* aligns with BE exemption)', () => {
    const hits = detectSensitiveKeys(
      { auth: { password: 'p', token: 't' }, other: { secret: 's' } },
      { exemptPaths: ['auth'] }
    )
    expect(hits).toEqual(['other.secret'])
  })

  it('exempt prefix matches segments precisely (does not over-match)', () => {
    // `auth` should NOT exempt `authorize.password`
    const hits = detectSensitiveKeys(
      { authorize: { password: 'p' } },
      { exemptPaths: ['auth'] }
    )
    expect(hits).toEqual(['authorize.password'])
  })

  it('handles self-referencing objects without infinite loop', () => {
    const a: Record<string, unknown> = { name: 'x' }
    a.self = a
    a.password = 'p'
    expect(detectSensitiveKeys(a)).toEqual(['password'])
  })

  it('keyword list stays aligned with BE SensitiveDataValidator (sanity)', () => {
    // 防止有人误删:列表至少包含 BE Lane C 列出的核心关键字(normalized 形态)
    for (const kw of ['password', 'token', 'secret', 'apikey', 'credential', 'privatekey']) {
      expect(SENSITIVE_KEYWORDS).toContain(kw)
    }
  })
})
