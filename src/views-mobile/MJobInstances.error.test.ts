// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import MJobInstances from './MJobInstances.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  tenant: null as unknown as { tenantId: string },
  intersect: null as null | (() => void),
  route: null as unknown as { path: string; query: Record<string, string> },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/api/instance', () => ({ instanceApi: { list: mocks.list } }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn(), success: vi.fn() },
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.list.mockReset()
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.route = reactive({ path: '/m/jobs', query: {} })
  mocks.intersect = null
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        mocks.intersect = () =>
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          )
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function render() {
  return shallowMount(MJobInstances, {
    global: { stubs: { MPullRefresh: { template: '<div><slot /></div>' } } },
  })
}

describe('移动作业列表加载', () => {
  it('首次查询失败提供重试，不显示空列表', async () => {
    mocks.list
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ records: [], total: 0, hasMore: false })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.jobs.empty')
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.jobs.empty')
  })

  it('SLA 查询失败时保留筛选提示，不显示零条结果', async () => {
    mocks.route.query.slaBreached = '1'
    mocks.list.mockRejectedValueOnce(new Error('network error'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('.m-filter-chip').text()).toContain('mobile.jobs.slaFilterActive')
    expect(wrapper.text()).not.toContain('mobile.jobs.slaFilterChip')
    expect(wrapper.text()).not.toContain('mobile.jobs.slaEmpty')
  })

  it('翻页失败保留已加载作业，并重试同一游标', async () => {
    mocks.list
      .mockResolvedValueOnce({
        records: [{ id: 1, jobCode: 'FIRST' }],
        total: 2,
        hasMore: true,
        nextCursor: 'next-a',
      })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ records: [{ id: 2, jobCode: 'SECOND' }], total: 2, hasMore: false })
    const wrapper = render()
    await flushPromises()
    mocks.intersect?.()
    await flushPromises()
    expect(wrapper.text()).toContain('FIRST')
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    await wrapper.get('.m-infinite button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('SECOND')
    expect(mocks.list.mock.calls[2][0].cursor).toBe('next-a')
  })

  it('切换租户后迟到的旧查询不能覆盖新列表', async () => {
    let finishOld!: (value: {
      records: { id: number; jobCode: string }[]
      total: number
      hasMore: boolean
    }) => void
    mocks.list.mockImplementation((query) =>
      query.tenantId === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ records: [{ id: 2, jobCode: 'CURRENT' }], total: 1, hasMore: false }),
    )
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ records: [{ id: 1, jobCode: 'OLD' }], total: 1, hasMore: false })
    await flushPromises()
    expect(wrapper.text()).toContain('CURRENT')
    expect(wrapper.text()).not.toContain('OLD')
  })

  it('切换状态后迟到的上一筛选分页不能追加到新列表', async () => {
    let finishMore!: (value: {
      records: { id: number; jobCode: string }[]
      total: number
      hasMore: boolean
    }) => void
    mocks.list.mockImplementation((query) => {
      if (query.cursor)
        return new Promise((resolve) => {
          finishMore = resolve
        })
      if (query.instanceStatus === 'FAILED')
        return Promise.resolve({
          records: [{ id: 3, jobCode: 'FAILED_JOB' }],
          total: 1,
          hasMore: false,
        })
      return Promise.resolve({
        records: [{ id: 1, jobCode: 'FIRST' }],
        total: 2,
        hasMore: true,
        nextCursor: 'next-a',
      })
    })
    const wrapper = render()
    await flushPromises()
    mocks.intersect?.()
    await wrapper.get('[role="tab"]:nth-child(3)').trigger('click')
    await flushPromises()
    finishMore({ records: [{ id: 2, jobCode: 'OLD_PAGE' }], total: 2, hasMore: false })
    await flushPromises()
    expect(wrapper.text()).toContain('FAILED_JOB')
    expect(wrapper.text()).not.toContain('OLD_PAGE')
  })
})
