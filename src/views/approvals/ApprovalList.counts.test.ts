// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import ApprovalList from './ApprovalList.vue'

const mocks = vi.hoisted(() => ({ general: vi.fn(), catchUp: vi.fn() }))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.general,
  queryCatchUpApprovalsPage: mocks.catchUp,
}))
vi.mock('./components/GeneralApprovalsTab.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./components/CatchUpApprovalsTab.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.general.mockReset().mockResolvedValue({ total: 2, items: [] })
  mocks.catchUp.mockReset().mockResolvedValue({ total: 3, items: [] })
})

describe('ApprovalList', () => {
  it('普通页签计数排除补跑，补跑页签仍使用独立查询', async () => {
    const wrapper = shallowMount(ApprovalList, {
      global: { stubs: { PageContainer: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    expect(mocks.general).toHaveBeenCalledWith('tenant-a', 1, 1, {
      approvalStatus: 'PENDING',
      excludeApprovalTypes: 'CATCH_UP',
    })
    expect(mocks.catchUp).toHaveBeenCalledWith('tenant-a', 1, 1)
    expect(wrapper.findAll('.ap-tab__count').map((count) => count.text())).toEqual(['2', '3'])
  })
})
