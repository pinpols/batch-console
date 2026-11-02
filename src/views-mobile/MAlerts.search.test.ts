// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import MAlerts from './MAlerts.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: false, ensureWriteAvailable: () => true }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/alertsQuery', () => ({ queryAlertsPage: mocks.query }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.query.mockReset().mockImplementation((_tenant, page, pageSize) => {
    if (pageSize === 1) return Promise.resolve({ items: [], total: 2 })
    const item =
      page === 1
        ? { id: 1, title: 'First alert', status: 'OPEN' }
        : { id: 2, title: 'Target alert', status: 'OPEN' }
    return Promise.resolve({ items: [item], total: 2 })
  })
})

describe('移动告警搜索', () => {
  it('首次查询失败时显示重试，恢复后显示告警', async () => {
    let failedOnce = false
    mocks.query.mockImplementation((_tenant, page, pageSize) => {
      if (pageSize === 1) return Promise.resolve({ items: [], total: 1 })
      if (!failedOnce) {
        failedOnce = true
        return Promise.reject(new Error('network error'))
      }
      return Promise.resolve({ items: [{ id: 1, title: 'First alert', status: 'OPEN' }], total: 1 })
    })
    const wrapper = shallowMount(MAlerts, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('.m-empty').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('mobile.common.loadFail')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('First alert')
  })

  it('搜索已加载结果时说明范围，无匹配仍可加载后续页', async () => {
    const wrapper = shallowMount(MAlerts, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
          MSearchBar: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            methods: { focus() {} },
          },
        },
      },
    })
    await flushPromises()
    await wrapper.get('.m-page__title-action').trigger('click')
    await wrapper.get('input').setValue('Target')
    expect(wrapper.text()).toContain('mobile.alerts.searchScope')
    expect(wrapper.text()).not.toContain('First alert')
    expect(wrapper.find('.m-load-more button').exists()).toBe(true)
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledWith('tenant-a', 2, 30, { status: 'OPEN' })
    expect(wrapper.text()).toContain('Target alert')
  })

  it('加载下一页失败后重试同一页，不跳过告警', async () => {
    let failedOnce = false
    mocks.query.mockImplementation((_tenant, page, pageSize) => {
      if (pageSize === 1) return Promise.resolve({ items: [], total: 2 })
      if (page === 2 && !failedOnce) {
        failedOnce = true
        return Promise.reject(new Error('network error'))
      }
      const item =
        page === 1
          ? { id: 1, title: 'First alert', status: 'OPEN' }
          : { id: 2, title: 'Second alert', status: 'OPEN' }
      return Promise.resolve({ items: [item], total: 2 })
    })
    const wrapper = shallowMount(MAlerts, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('First alert')
    expect(wrapper.get('[role="alert"]').text()).toContain('mobile.common.loadFail')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    const pageRequests = mocks.query.mock.calls
      .filter((args) => args[2] === 30)
      .map((args) => args[1])
    expect(pageRequests).toEqual([1, 2, 2])
    expect(wrapper.text()).toContain('Second alert')
  })
})
