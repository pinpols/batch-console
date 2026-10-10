import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readThemePreference,
  resolveEffectiveTheme,
  resolveThemeForPath,
  THEME_REDESIGN_DEFAULT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './theme'
import { stubLocalStorage } from '@/test-utils/localStorage'

const storage = stubLocalStorage()

describe('theme', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('defaults to dark when no user preference is stored', () => {
    expect(readThemePreference()).toBe('dark')
  })

  it('preserves stored user preference', () => {
    storage.set(THEME_STORAGE_KEY, 'light')

    expect(readThemePreference()).toBe('light')
  })

  it('migrates legacy system default to dark once', () => {
    storage.set(THEME_STORAGE_KEY, 'system')

    expect(readThemePreference()).toBe('dark')
  })

  it('preserves explicit system preference after redesign marker exists', () => {
    storage.set(THEME_STORAGE_KEY, 'system')
    storage.set(THEME_REDESIGN_DEFAULT_STORAGE_KEY, '1')

    expect(readThemePreference()).toBe('system')
  })

  it('resolves system preference from current color scheme', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
  })

  it('keeps the login entry dark without changing other route preferences', () => {
    expect(resolveThemeForPath('/login', 'light', false)).toBe('dark')
    expect(resolveThemeForPath('/login/', 'system', false)).toBe('dark')
    expect(resolveThemeForPath('/ops/summary', 'light', true)).toBe('light')
    expect(resolveThemeForPath('/ops/summary', 'system', true)).toBe('dark')
  })
})
