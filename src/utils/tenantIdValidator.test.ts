import { describe, it, expect } from 'vitest'
import { validateTenantId } from './tenantIdValidator'

describe('validateTenantId', () => {
  it('empty / null / undefined → EMPTY', () => {
    expect(validateTenantId('')).toEqual({ ok: false, violation: 'EMPTY' })
    expect(validateTenantId(null)).toEqual({ ok: false, violation: 'EMPTY' })
    expect(validateTenantId(undefined)).toEqual({ ok: false, violation: 'EMPTY' })
  })

  it('valid ids pass', () => {
    expect(validateTenantId('tenant-a')).toEqual({ ok: true })
    expect(validateTenantId('CompanyA')).toEqual({ ok: true })
    expect(validateTenantId('a')).toEqual({ ok: true })
    expect(validateTenantId('a.b.c-2025_v1')).toEqual({ ok: true })
  })

  it('format rejects leading non-alphanumeric', () => {
    expect(validateTenantId('-tenant')).toEqual({ ok: false, violation: 'FORMAT' })
    expect(validateTenantId('.tenant')).toEqual({ ok: false, violation: 'FORMAT' })
    expect(validateTenantId('_tenant')).toEqual({ ok: false, violation: 'FORMAT' })
  })

  it('format rejects illegal chars (space / unicode / special)', () => {
    expect(validateTenantId('tenant a').ok).toBe(false)
    expect(validateTenantId('租户1').ok).toBe(false)
    expect(validateTenantId('a!b').ok).toBe(false)
    expect(validateTenantId('a@b').ok).toBe(false)
  })

  it('format enforces 64-char max', () => {
    expect(validateTenantId('a'.repeat(64))).toEqual({ ok: true })
    expect(validateTenantId('a'.repeat(65))).toEqual({ ok: false, violation: 'FORMAT' })
  })

  it('reserved ids rejected (case-insensitive)', () => {
    expect(validateTenantId('system')).toEqual({ ok: false, violation: 'RESERVED_ID' })
    expect(validateTenantId('SYSTEM')).toEqual({ ok: false, violation: 'RESERVED_ID' })
    expect(validateTenantId('Admin')).toEqual({ ok: false, violation: 'RESERVED_ID' })
    expect(validateTenantId('default')).toEqual({ ok: false, violation: 'RESERVED_ID' })
  })

  it('reserved prefixes rejected with matchedPrefix', () => {
    expect(validateTenantId('e2e-foo')).toEqual({
      ok: false,
      violation: 'RESERVED_PREFIX',
      matchedPrefix: 'e2e-',
    })
    expect(validateTenantId('QA-Smoke')).toEqual({
      ok: false,
      violation: 'RESERVED_PREFIX',
      matchedPrefix: 'qa-',
    })
    expect(validateTenantId('dev-x')).toMatchObject({
      ok: false,
      matchedPrefix: 'dev-',
    })
    expect(validateTenantId('local-1')).toMatchObject({ matchedPrefix: 'local-' })
    expect(validateTenantId('test-y')).toMatchObject({ matchedPrefix: 'test-' })
  })

  it('legitimate tenant containing reserved substring (not prefix) passes', () => {
    // "best-tenant" contains "test-" but doesn't START with it (begins with "best-")
    expect(validateTenantId('best-tenant')).toEqual({ ok: true })
    // "edevops" doesn't start with "dev-"
    expect(validateTenantId('edevops')).toEqual({ ok: true })
  })
})
