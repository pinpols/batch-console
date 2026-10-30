// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import CatchUpApprovalsTab from './CatchUpApprovalsTab.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  query: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/api/approvals', () => ({ queryCatchUpApprovalsPage: mocks.query }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)
function pending<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
function page(requestId: string) {
  return { items: [{ requestId, workflowCode: 'WF', bizDate: '2026-10-26' }], total: 1 }
}
function render() {
  return shallowMount(CatchUpApprovalsTab)
}
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.query.mockReset().mockResolvedValue(page('request-b'))
})
describe('补跑审批只显示当前租户与当前页请求', () => {
  it('迟到的旧租户列表不能覆盖新租户结果', async () => {
    const first = pending<ReturnType<typeof page>>()
    mocks.query.mockReturnValueOnce(first.promise)
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    first.resolve(page('request-a'))
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ProTable' }).props('data')).toEqual(
      page('request-b').items,
    )
  })

  it('迟到的旧租户错误不能清空新结果或留下错误态', async () => {
    const first = pending<ReturnType<typeof page>>()
    mocks.query.mockReturnValueOnce(first.promise)
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    first.reject(new Error('old request failed'))
    await flushPromises()
    const table = wrapper.findComponent({ name: 'ProTable' })
    expect(table.props('data')).toEqual(page('request-b').items)
    expect(table.props('error')).toBeNull()
  })

  it('切换租户立即关闭已经打开的旧审批详情', async () => {
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'ProTable' }).vm.$emit('row-click', page('request-a').items[0])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'DetailDrawer' }).props('visible')).toBe(true)
    mocks.tenant.tenantId = ''
    await flushPromises()
    expect(wrapper.findComponent({ name: 'DetailDrawer' }).props('visible')).toBe(false)
    expect(wrapper.findComponent({ name: 'ProTable' }).props('data')).toEqual([])
  })

  it('同租户翻页响应乱序时保持最新页结果', async () => {
    const first = pending<ReturnType<typeof page>>()
    mocks.query.mockReturnValueOnce(first.promise)
    const wrapper = render()
    const table = wrapper.findComponent({ name: 'ProTable' })
    table.vm.$emit('update:page', 2)
    table.vm.$emit('change')
    await flushPromises()
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 2, 15, {
      keyword: undefined,
      bizDate: undefined,
    })
    first.resolve(page('request-first-page'))
    await flushPromises()
    expect(table.props('data')).toEqual(page('request-b').items)
  })

  it('当前请求失败仍展示错误并允许再次加载', async () => {
    const error = new Error('current failure')
    mocks.query.mockRejectedValueOnce(error)
    const wrapper = render()
    await flushPromises()
    const table = wrapper.findComponent({ name: 'ProTable' })
    expect(table.props('error')).toBe(error)
    table.vm.$emit('change')
    await flushPromises()
    expect(table.props('error')).toBeNull()
    expect(table.props('data')).toEqual(page('request-b').items)
  })
})
