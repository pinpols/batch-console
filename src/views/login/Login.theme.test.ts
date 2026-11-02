// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { stubLocalStorage } from '@/test-utils/localStorage'
import { useAppStore } from '@/stores/app'
import Login from './Login.vue'

vi.mock('@/api/captcha', () => ({
  getCaptchaConfig: vi.fn().mockResolvedValue({ provider: 'none', loginProtectionEnabled: false }),
}))
vi.mock('@/api/oidc', () => ({
  getConsoleOidcProvider: vi.fn().mockResolvedValue({ enabled: false }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ login: vi.fn() }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useLocale', async () => {
  const { ref } = await import('vue')
  return { useLocale: () => ({ current: ref('zh-CN'), setLocale: vi.fn() }) }
})

type Listener = (event: MediaQueryListEvent) => void
let listeners: Set<Listener>
let isDark: boolean
let storage: ReturnType<typeof stubLocalStorage>
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
  vi.stubGlobal('__APP_VERSION__', 'test')
  setActivePinia(createPinia())
})
afterEach(() => {
  useAppStore().$dispose()
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

describe('登录页主题', () => {
  it('默认跟随系统变化，离开登录页后不重置偏好', async () => {
    const wrapper = shallowMount(Login)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    setSystemDark(true)
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    wrapper.unmount()
    expect(useAppStore().themePreference).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('已手动选择浅色时，即使系统深色也保留浅色', () => {
    storage.set(STORAGE_KEYS.theme, 'light')
    isDark = true
    const wrapper = shallowMount(Login)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    wrapper.unmount()
  })
})
