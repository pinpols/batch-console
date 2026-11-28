// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutHeader from './LayoutHeader.vue'

const mocks = vi.hoisted(() => ({ push: vi.fn(), canOpenPath: vi.fn(() => true) }))

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), forward: vi.fn(), push: mocks.push }),
}))
vi.mock('@/composables/useRouteAccess', () => ({
  useRouteAccess: () => ({ canOpenPath: mocks.canOpenPath }),
}))
vi.mock('@/layout/composables/useHeaderLogic', () => ({
  useHeaderLogic: () => ({
    app: { theme: 'light', themePreference: 'light', nextThemePreference: 'dark' },
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

function mountHeader() {
  return mount(LayoutHeader, {
    global: {
      stubs: {
        ElHeader: { template: '<header><slot /></header>' },
        ElTooltip: { template: '<span><slot /></span>' },
        ElDropdown: {
          name: 'ElDropdown',
          emits: ['command'],
          template: '<div><slot /><slot name="dropdown" /></div>',
        },
        ElDropdownMenu: { template: '<div class="user-menu-list"><slot /></div>' },
        ElDropdownItem: { template: '<div class="menu-item"><slot /></div>' },
        ElBreadcrumb: { template: '<div><slot /></div>' },
        ElBreadcrumbItem: { template: '<div><slot /></div>' },
        ElIcon: { template: '<span><slot /></span>' },
        NotificationCenter: true,
        TenantSelect: true,
        DisplayTimezoneMenu: true,
      },
    },
  })
}

describe('LayoutHeader user menu', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.canOpenPath.mockReset().mockReturnValue(true)
  })

  it('lists "my account" first and includes "my API keys" without legacy permission self-check', () => {
    const wrapper = mountHeader()
    const userMenu = wrapper
      .findAll('.user-menu-list')
      .find((menu) => menu.text().includes('nav.logout'))
    const items = userMenu!.findAll('.menu-item').map((item) => item.attributes('command'))

    expect(items[0]).toBe('account')
    expect(items).toContain('api-keys')
    expect(items).not.toContain('profile')
  })

  it('hides "my API keys" when current role cannot open /system/api-keys', () => {
    mocks.canOpenPath.mockReturnValue(false)
    const wrapper = mountHeader()
    const userMenu = wrapper
      .findAll('.user-menu-list')
      .find((menu) => menu.text().includes('nav.logout'))
    const items = userMenu!.findAll('.menu-item').map((item) => item.attributes('command'))

    expect(items[0]).toBe('account')
    expect(items).not.toContain('api-keys')
  })

  it('opens /system/me from "my account" and /system/api-keys from "my API keys"', async () => {
    const wrapper = mountHeader()
    for (const dropdown of wrapper.findAllComponents({ name: 'ElDropdown' })) {
      dropdown.vm.$emit('command', 'account')
      dropdown.vm.$emit('command', 'api-keys')
    }
    await flushPromises()

    expect(mocks.push).toHaveBeenCalledWith('/system/me')
    expect(mocks.push).toHaveBeenCalledWith('/system/api-keys')
  })
})
