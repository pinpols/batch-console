// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { stubLocalStorage } from '@/test-utils/localStorage'
import { useAppStore } from './app'

type Listener = (event: MediaQueryListEvent) => void
let storage: ReturnType<typeof stubLocalStorage>
let listeners: Set<Listener>
let isDark: boolean

function setSystemDark(value: boolean) {
  isDark = value
  for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent)
}

beforeEach(() => {
  storage = stubLocalStorage()
  listeners = new Set()
  isDark = false
  document.documentElement.classList.remove('dark')
  const systemMedia = {
    get matches() {
      return isDark
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('prefers-color-scheme') ? systemMedia : { matches: false },
  )
  setActivePinia(createPinia())
})

afterEach(() => {
  useAppStore().$dispose()
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

describe('主题偏好与系统变化', () => {
  it('无手动偏好时跟随系统并实时更新页面', async () => {
    const store = useAppStore()
    expect(store.themePreference).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    setSystemDark(true)
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    setSystemDark(false)
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it.each(['light', 'dark', 'system'] as const)('保留并在刷新后恢复已保存的 %s', async (value) => {
    storage.set(STORAGE_KEYS.theme, value)
    const store = useAppStore()
    expect(store.themePreference).toBe(value)
    store.$dispose()
    setActivePinia(createPinia())
    const restored = useAppStore()
    expect(restored.themePreference).toBe(value)
    expect(storage.get(STORAGE_KEYS.theme)).toBe(value)
    await nextTick()
  })

  it.each([
    [false, ['dark', 'light', 'system']],
    [true, ['light', 'dark', 'system']],
  ] as const)('根据系统明暗一键切换并覆盖三个偏好 (dark=%s)', async (dark, expected) => {
    isDark = dark
    const store = useAppStore()
    for (const preference of expected) {
      expect(store.nextThemePreference).toBe(preference)
      store.toggleTheme()
      await nextTick()
      expect(store.themePreference).toBe(preference)
      expect(storage.get(STORAGE_KEYS.theme)).toBe(preference)
    }
  })

  it('手动模式期间系统变化更新下一步但不改变当前外观', async () => {
    const store = useAppStore()
    store.setThemePreference('dark')
    await nextTick()
    expect(store.nextThemePreference).toBe('light')
    setSystemDark(true)
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(store.nextThemePreference).toBe('system')
  })

  it('手动设置后系统变化不覆盖选择，改回系统后重新跟随', async () => {
    const store = useAppStore()
    store.setThemePreference('light')
    await nextTick()
    setSystemDark(true)
    await nextTick()
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    store.setThemePreference('system')
    await nextTick()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
