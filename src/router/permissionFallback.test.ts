import { describe, expect, it } from 'vitest'
import { permissionFallback } from './permissionFallback'

describe('permission fallback', () => {
  it('does not redirect to the protected homepage when the profile or homepage access is missing', () => {
    expect(permissionFallback(false, true, true)).toBe('/system/me')
    expect(permissionFallback(true, false, true)).toBe('/system/me')
    expect(permissionFallback(true, true, false)).toBe('/system/me')
    expect(permissionFallback(true, true, true)).toBe('/')
  })
})
