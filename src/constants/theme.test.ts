import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readThemePreference,
  resolveEffectiveTheme,
  THEME_REDESIGN_DEFAULT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './theme'

const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
})

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
})
