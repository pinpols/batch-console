// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutHeader from './LayoutHeader.vue'
import zh from '@/locales/zh-CN'
import en from '@/locales/en-US'

const mocks = vi.hoisted(() => ({
  app: {} as {
    theme: 'light' | 'dark'
    themePreference: 'system' | 'light' | 'dark'
    nextThemePreference: 'system' | 'light' | 'dark'
    toggleTheme: () => void
    setThemePreference: (value: 'system' | 'light' | 'dark') => void
  },
  info: vi.fn(),
}))

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, args?: Record<string, string>) =>
      args ? `${key}:${args.current ?? ''}:${args.next ?? ''}:${args.theme ?? ''}` : key,
  }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { info: mocks.info },
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), forward: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/layout/composables/useHeaderLogic', () => ({
  useHeaderLogic: () => ({
    app: mocks.app,
    auth: { userInfo: null },
    breadcrumbs: [],
    tenantIdInput: '',
    canSwitchTenant: false,
    handleTenantSwitch: vi.fn(),
    commandPaletteShortcutLabel: 'Ctrl+K',
    handleLogout: vi.fn(),
  }),
}))
vi.mock('@/composables/useLocale', () => ({
  useLocale: () => ({ current: ref('zh-CN'), setLocale: vi.fn() }),
}))
vi.mock('@/stores/mobileBadges', () => ({
  useMobileBadgesStore: () => ({
    refresh: vi.fn(),
    pendingApprovals: 0,
    openAlerts: 0,
    criticalAlerts: 0,
    failedJobs: 0,
  }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: '' }) }))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))

describe('LayoutHeader theme control', () => {
  beforeEach(() => {
    mocks.app = reactive({
      theme: 'dark' as 'light' | 'dark',
      themePreference: 'system' as 'system' | 'light' | 'dark',
      get nextThemePreference(): 'system' | 'light' | 'dark' {
        return this.themePreference === 'system'
          ? 'light'
          : this.themePreference === 'light'
            ? 'dark'
            : 'system'
      },
      toggleTheme() {
        const next = this.nextThemePreference
        this.themePreference = next
        if (next !== 'system') this.theme = next
      },
      setThemePreference(value: 'system' | 'light' | 'dark') {
        this.themePreference = value
      },
    })
  })

  it('cycles all preferences by one click and announces the current and next modes', async () => {
    const wrapper = mount(LayoutHeader, {
      global: {
        stubs: {
          ElHeader: { template: '<header><slot /></header>' },
          ElTooltip: { template: '<span><slot /></span>' },
          ElDropdown: {
            name: 'ElDropdown',
            emits: ['command'],
            template: '<div><slot /><slot name="dropdown" /></div>',
          },
          ElDropdownMenu: { template: '<div><slot /></div>' },
          ElDropdownItem: { template: '<div><slot /></div>' },
          ElBreadcrumb: { template: '<div><slot /></div>' },
          ElBreadcrumbItem: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          NotificationCenter: true,
          TenantSelect: true,
        },
      },
    })

    expect(wrapper.text()).not.toContain('nav.mobilePreview')
    expect(wrapper.text()).not.toContain('nav.onboardingCenter')
    expect(wrapper.text()).toContain('nav.interfaceTour')
    expect(wrapper.find('.timezone-trigger').exists()).toBe(false)
    expect(wrapper.get('.timezone-entry').text()).toContain('layoutHeader.timezoneLabel')
    const themeButton = () => wrapper.get('button[aria-label^="nav.themeControlLabel:"]')
    expect(themeButton().attributes('type')).toBe('button')
    expect(themeButton().attributes('aria-label')).toBe(
      'nav.themeControlLabel:nav.themeFollowSystem:nav.themeLight:',
    )
    expect(themeButton().find('.lucide-monitor').exists()).toBe(true)
    await themeButton().trigger('click')
    expect(mocks.app.themePreference).toBe('light')
    expect(themeButton().attributes('title')).toBe(
      'nav.themeControlLabel:nav.themeLight:nav.themeDark:',
    )
    await themeButton().trigger('click')
    expect(mocks.app.themePreference).toBe('dark')
    await themeButton().trigger('click')
    expect(mocks.app.themePreference).toBe('system')
    expect(mocks.info).toHaveBeenLastCalledWith('nav.themeSelected:::nav.themeFollowSystem')
    expect(wrapper.text()).not.toContain('nav.themeFollowSystem')
    wrapper.unmount()
  })
})

it('provides understandable current and next mode messages in both languages', () => {
  expect(zh.nav.themeControlLabel).toContain('{current}')
  expect(zh.nav.themeControlLabel).toContain('{next}')
  expect(en.nav.themeControlLabel).toContain('{current}')
  expect(en.nav.themeControlLabel).toContain('{next}')
  expect(zh.nav.themeSelected).toContain('{theme}')
  expect(en.nav.themeSelected).toContain('{theme}')
})
