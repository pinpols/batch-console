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
  useI18n: () => ({
    t: (key: string) => key,
    te: (key: string) => key === 'enum.triggerRequestStatus.ACCEPTED',
  }),
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
  it('分别展示请求状态和可空的审批状态', async () => {
    const row = {
      ...page('request-b').items[0],
      requestStatus: 'ACCEPTED',
      approvalStatus: 'PENDING',
    }
    mocks.query.mockResolvedValue({ items: [row], total: 1 })
    const wrapper = shallowMount(CatchUpApprovalsTab, {
      global: {
        stubs: {
          DetailDrawer: { props: ['visible'], template: '<div v-if="visible"><slot /></div>' },
          ElDescriptions: { template: '<div><slot /></div>' },
          ElDescriptionsItem: {
            props: ['label'],
            template: '<div :data-label="label"><slot /></div>',
          },
        },
      },
    })
    await flushPromises()
    wrapper.findComponent({ name: 'ProTable' }).vm.$emit('row-click', row)
    await flushPromises()
    expect(wrapper.get('[data-label="approvals.catchUpRequestStatus"]').text()).toBe(
      'enum.triggerRequestStatus.ACCEPTED',
    )
    expect(
      wrapper
        .get('[data-label="approvals.catchUpApprovalStatus"]')
        .findComponent({ name: 'StatusTag' })
        .props('value'),
    ).toBe('PENDING')
    wrapper
      .findComponent({ name: 'ProTable' })
      .vm.$emit('row-click', { ...row, approvalStatus: null })
    await flushPromises()
    expect(wrapper.get('[data-label="approvals.catchUpApprovalStatus"]').text()).toBe('—')
  })
  it('查看完整请求号时不打开审批详情', async () => {
    const wrapper = shallowMount(CatchUpApprovalsTab, {
      global: {
        stubs: {
          ProTable: {
            props: ['data'],
            emits: ['row-click'],
            template:
              '<div data-testid="table" @click="$emit(\'row-click\', data[0])"><slot /></div>',
          },
          ElTableColumn: {
            props: ['prop'],
            template:
              '<div v-if="prop === \'requestId\'"><slot :row="{ requestId: \'request-b\' }" /></div>',
          },
          CopyableText: {
            props: ['text'],
            template: '<button data-testid="request-id">{{ text }}</button>',
          },
        },
      },
    })
    await flushPromises()
    await wrapper.get('[data-testid="request-id"]').trigger('click')
    expect(wrapper.findComponent({ name: 'DetailDrawer' }).props('visible')).toBe(false)
    await wrapper.get('[data-testid="table"]').trigger('click')
    expect(wrapper.findComponent({ name: 'DetailDrawer' }).props('visible')).toBe(true)
  })

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
