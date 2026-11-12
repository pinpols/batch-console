// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import MApprovals from './MApprovals.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'operator' } }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: { value: true } }),
}))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: false, ensureWriteAvailable: () => true }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.query,
  approveOne: vi.fn(),
  rejectOne: vi.fn(),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.query.mockReset()
})

describe('移动审批分页', () => {
  it('所有状态列表与状态计数均排除补跑，包括已批准和已执行两条查询', async () => {
    mocks.query.mockResolvedValue({ items: [], total: 0 })
    const wrapper = shallowMount(MApprovals, {
      global: { stubs: { MPullRefresh: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    for (const tab of wrapper.findAll('[role="tab"]')) {
      await tab.trigger('click')
      await flushPromises()
    }
    expect(mocks.query.mock.calls.filter((args) => args[2] === 1)).toHaveLength(20)
    expect(mocks.query.mock.calls.filter((args) => args[2] === 30)).toHaveLength(5)
    for (const args of mocks.query.mock.calls) {
      expect(args[3]).toMatchObject({ excludeApprovalTypes: 'CATCH_UP' })
    }
  })

  it('下一页请求失败后重试同页，避免遗漏审批', async () => {
    let failedOnce = false
    mocks.query.mockImplementation((_tenant, page, size) => {
      if (size === 1) return Promise.resolve({ items: [], total: 2 })
      if (page === 2 && !failedOnce) {
        failedOnce = true
        return Promise.reject(new Error('network error'))
      }
      return Promise.resolve({
        items: [{ approvalNo: `APPROVAL-${page}`, approvalStatus: 'PENDING' }],
        total: 2,
      })
    })
    const wrapper = shallowMount(MApprovals, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    const pages = mocks.query.mock.calls.filter((args) => args[2] === 30).map((args) => args[1])
    expect(pages).toEqual([1, 2, 2])
    for (const args of mocks.query.mock.calls) {
      expect(args[3]).toMatchObject({ excludeApprovalTypes: 'CATCH_UP' })
    }
    expect(wrapper.text()).toContain('APPROVAL-2')
  })

  it('已批准与已执行合并列表重试同一页', async () => {
    let failedOnce = false
    mocks.query.mockImplementation((_tenant, page, size, filters) => {
      if (size === 1) return Promise.resolve({ items: [], total: 2 })
      if (page === 2 && filters.approvalStatus === 'APPROVED' && !failedOnce) {
        failedOnce = true
        return Promise.reject(new Error('network error'))
      }
      return Promise.resolve({
        items: [
          {
            approvalNo: `${filters.approvalStatus}-${page}`,
            approvalStatus: filters.approvalStatus,
          },
        ],
        total: 2,
      })
    })
    const wrapper = shallowMount(MApprovals, {
      global: {
        stubs: {
          MPullRefresh: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    const approvedPages = mocks.query.mock.calls
      .filter((args) => args[2] === 30 && args[3]?.approvalStatus === 'APPROVED')
      .map((args) => args[1])
    expect(approvedPages).toEqual([1, 2, 2])
    expect(wrapper.text()).toContain('APPROVED-2')
    expect(wrapper.text()).toContain('EXECUTED-2')
  })
})
