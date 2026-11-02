// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import QuotaPanel from './QuotaPanel.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), refreshSuccess: vi.fn() }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => Promise<void>) => {
    void load()
  },
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: ref(false) }),
}))
vi.mock('@/api/governance', () => ({ governanceApi: { listQuotaPolicies: mocks.list } }))
vi.mock('@/composables/useListFilterFeedback', () => ({
  useListFilterFeedback: () => ({
    filterBusy: ref(false),
    runSearch: vi.fn(),
    runReset: vi.fn(),
    runRefresh: async (load: () => Promise<void>) => {
      await load()
      mocks.refreshSuccess()
    },
  }),
}))

const slot = { template: '<div><slot /></div>' }
const stubs = {
  PageContainer: slot,
  ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}<slot /></div>' },
  ElButton: { template: '<button type="button"><slot /></button>' },
  EmptyState: { props: ['description'], template: '<div>{{ description }}</div>' },
  ListPageQueryBar: {
    template: '<button type="button" @click="$emit(\'refresh\')">refresh</button>',
  },
}

describe('QuotaPanel', () => {
  beforeEach(() => {
    mocks.list.mockReset()
    mocks.refreshSuccess.mockReset()
  })

  it('加载失败展示错误并可重试，不显示空数据', async () => {
    mocks.list.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
    const wrapper = shallowMount(QuotaPanel, { global: { stubs } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('quotaPanel.loadError')
    expect(wrapper.text()).not.toContain('quotaPanel.empty')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('quotaPanel.empty')
    wrapper.unmount()
  })

  it('刷新失败不提示刷新成功', async () => {
    mocks.list.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network'))
    const wrapper = shallowMount(QuotaPanel, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'refresh')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('quotaPanel.loadError')
    expect(mocks.refreshSuccess).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
