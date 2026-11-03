import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readThemePreference, resolveEffectiveTheme, THEME_STORAGE_KEY } from './theme'
import { stubLocalStorage } from '@/test-utils/localStorage'
import { STORAGE_KEYS } from './storageKeys'

const storage = stubLocalStorage()

describe('theme', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('defaults to system when no user preference is stored', () => {
    expect(readThemePreference()).toBe('system')
  })

  it.each(['light', 'dark', 'system'] as const)('preserves stored %s preference', (value) => {
    storage.set(THEME_STORAGE_KEY, value)
    expect(readThemePreference()).toBe(value)
  })

  it('ignores the legacy redesign marker when preserving system preference', () => {
    storage.set(THEME_STORAGE_KEY, 'system')
    storage.set(STORAGE_KEYS.themeRedesignDefault, '0')
    expect(readThemePreference()).toBe('system')
  })

  it('preserves explicit system preference after redesign marker exists', () => {
    storage.set(THEME_STORAGE_KEY, 'system')
    storage.set(STORAGE_KEYS.themeRedesignDefault, '1')

    expect(readThemePreference()).toBe('system')
  })

  it('resolves system preference from current color scheme', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
  })
})
