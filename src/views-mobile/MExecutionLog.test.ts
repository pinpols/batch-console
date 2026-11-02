// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import MExecutionLog from './MExecutionLog.vue'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  tenant: null as unknown as { tenantId: string },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/observabilityQueries', () => ({ queryAuditsPage: mocks.query }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn() },
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.query.mockReset()
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
})

function render() {
  return shallowMount(MExecutionLog, {
    global: { stubs: { MPullRefresh: { template: '<div><slot /></div>' } } },
  })
}

describe('移动执行日志加载', () => {
  it('首次加载失败显示可重试错误，不显示无日志', async () => {
    mocks.query
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ items: [], total: 0 })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.executionLog.empty')
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.executionLog.empty')
    expect(wrapper.text()).not.toContain('mobile.common.loadFail')
  })

  it('加载更多失败保留记录，重试同一页', async () => {
    mocks.query.mockImplementation((_tenant, page) => {
      if (page === 1)
        return Promise.resolve({ items: [{ id: 1, operationType: 'FIRST' }], total: 2 })
      if (mocks.query.mock.calls.filter((call) => call[1] === 2).length === 1)
        return Promise.reject(new Error('network error'))
      return Promise.resolve({ items: [{ id: 2, operationType: 'SECOND' }], total: 2 })
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('.m-load-more button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('FIRST')
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(mocks.query.mock.calls.map((call) => call[1])).toEqual([1, 2, 2])
    expect(wrapper.text()).toContain('FIRST')
    expect(wrapper.text()).toContain('SECOND')
  })

  it('切换租户后迟到的旧日志不能覆盖当前租户', async () => {
    let finishOld!: (value: {
      items: { id: number; operationType: string }[]
      total: number
    }) => void
    mocks.query.mockImplementation((tenant: string) =>
      tenant === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ items: [{ id: 2, operationType: 'CURRENT' }], total: 1 }),
    )
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ items: [{ id: 1, operationType: 'OLD' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('CURRENT')
    expect(wrapper.text()).not.toContain('OLD')
  })

  it('清空租户时丢弃迟到的旧日志，重新选择租户后只显示新结果', async () => {
    let finishOld!: (value: {
      items: { id: number; operationType: string }[]
      total: number
    }) => void
    mocks.query.mockImplementation((tenant: string) =>
      tenant === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ items: [{ id: 2, operationType: 'CURRENT' }], total: 1 }),
    )
    const wrapper = render()

    mocks.tenant.tenantId = ''
    await flushPromises()
    finishOld({ items: [{ id: 1, operationType: 'OLD' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).not.toContain('OLD')
    expect(mocks.query).toHaveBeenCalledTimes(1)

    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).toContain('CURRENT')
    expect(wrapper.text()).not.toContain('OLD')

    mocks.tenant.tenantId = ''
    await flushPromises()
    expect(wrapper.text()).not.toContain('CURRENT')
    expect(mocks.query).toHaveBeenCalledTimes(2)
  })

  it('切换租户时立即清除旧日志，直到新租户请求完成', async () => {
    let finishNew!: (value: {
      items: { id: number; operationType: string }[]
      total: number
    }) => void
    mocks.query.mockImplementation((tenant: string) =>
      tenant === 'tenant-a'
        ? Promise.resolve({ items: [{ id: 1, operationType: 'OLD' }], total: 1 })
        : new Promise((resolve) => {
            finishNew = resolve
          }),
    )
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('OLD')

    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).not.toContain('OLD')
    expect(wrapper.text()).not.toContain('CURRENT')

    finishNew({ items: [{ id: 2, operationType: 'CURRENT' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('CURRENT')
    expect(wrapper.text()).not.toContain('OLD')
  })
})
