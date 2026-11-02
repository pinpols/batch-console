// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import ElementPlus from 'element-plus'
import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import DependencyWaitPanel from './DependencyWaitPanel.vue'

const api = vi.hoisted(() => ({ calendar: vi.fn(), jobs: vi.fn(), persistent: vi.fn() }))
vi.mock('@/api/dependencyWaits', () => ({
  listCalendarDependencyWaits: api.calendar,
  listJobDependencyWaits: api.jobs,
  requestCalendarDependencyWaitAction: vi.fn(),
}))
vi.mock('@/api/persistentWaits', () => ({ listPersistentWaits: api.persistent }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'operator' } }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ hasPermission: () => true, canWriteSystem: ref(true) }),
}))
vi.mock('@/composables/useTenantRequestScope', () => ({
  useTenantRequestScope: () => ({ begin: vi.fn(), isCurrent: vi.fn() }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  api.calendar.mockReset().mockResolvedValue([])
  api.jobs.mockReset().mockResolvedValue([])
  api.persistent.mockReset().mockResolvedValue({ items: [], total: 0 })
})

function render() {
  return mount(DependencyWaitPanel, {
    global: {
      plugins: [
        ElementPlus,
        createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } }),
      ],
      stubs: {
        SectionCard: { template: '<section><slot name="header" /><slot /></section>' },
        CalendarDependencyWaitTable: {
          template: '<div class="calendar-empty">calendar empty</div>',
        },
        JobDependencyWaitTable: { template: '<div class="job-empty">job empty</div>' },
        PersistentWaitTable: { template: '<div class="persistent-empty">persistent empty</div>' },
        WaitRelationshipGraph: true,
      },
    },
  })
}

describe('依赖等待加载状态', () => {
  it.each([
    ['calendar', 1, 'calendar-empty'],
    ['jobs', 2, 'job-empty'],
    ['persistent', 3, 'persistent-empty'],
  ] as const)('%s 查询失败时不显示空列表', async (kind, tabIndex, tableClass) => {
    api[kind].mockRejectedValueOnce(new Error('network error'))
    const wrapper = render()
    await flushPromises()
    if (tabIndex !== 1) {
      await wrapper.findAll('[role="tab"]')[tabIndex]!.trigger('click')
      await flushPromises()
    }
    expect(wrapper.text()).toContain(zhCN.dependencyWaits.loadError)
    expect(wrapper.find(`.${tableClass}`).exists()).toBe(false)
    const refresh = wrapper
      .findAll('button')
      .find((button) => button.text() === zhCN.common.refresh)
    expect(refresh).toBeDefined()
    await refresh!.trigger('click')
    await flushPromises()
    expect(wrapper.find(`.${tableClass}`).exists()).toBe(true)
    expect(wrapper.text()).not.toContain(zhCN.dependencyWaits.loadError)
  })
})
