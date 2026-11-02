// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import FilePipelineObservability from './FilePipelineObservability.vue'

const mocks = vi.hoisted(() => ({
  pipelines: vi.fn(),
  steps: vi.fn(),
  dispatches: vi.fn(),
  errors: vi.fn(),
  message: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({
  useTenantReload: (load: () => Promise<void>) => void load(),
}))
vi.mock('@/composables/useBriefActionLoading', () => ({
  useBriefActionLoading: () => ({ busy: ref(false), run: (fn: () => Promise<void>) => fn() }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: mocks.message,
}))
vi.mock('@/composables/useLivePipelineProgress', () => ({
  useLivePipelineProgress: () => ({
    progress: ref(null),
    byStepId: ref(new Map()),
    unavailable: ref(false),
    lastSucceededAt: ref(null),
    status: ref('idle'),
    failedPipelineIds: ref(new Set()),
    estimateMinutes: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('@/api/filePipelineQuery', () => ({
  queryFilePipelinePage: mocks.pipelines,
  queryFilePipelineStepPage: mocks.steps,
  queryFileDispatchPage: mocks.dispatches,
  queryFileErrorPage: mocks.errors,
}))

enableAutoUnmount(afterEach)
const pass = { template: '<div><slot /><slot name="query" /><slot name="toolbar" /></div>' }
const table = {
  name: 'ProTable',
  props: ['data', 'error', 'onRetry', 'total'],
  template: '<div><slot name="query" /></div>',
}
function render() {
  return shallowMount(FilePipelineObservability, {
    global: {
      stubs: {
        PageContainer: pass,
        PageHeader: true,
        ElTabs: { name: 'ElTabs', template: '<div><slot /></div>' },
        ElTabPane: pass,
        ProTable: table,
        ListPageQueryBar: { name: 'ListPageQueryBar', template: '<div><slot /></div>' },
        ElFormItem: pass,
        RouterLink: true,
      },
    },
  })
}
beforeEach(() => {
  mocks.message.mockReset()
  for (const fn of [mocks.pipelines, mocks.steps, mocks.dispatches, mocks.errors]) {
    fn.mockReset().mockResolvedValue({ items: [], total: 0 })
  }
})
describe('文件流水线记录错误态', () => {
  it.each([
    ['dispatches', 'dispatches', 2],
    ['errors', 'errors', 3],
  ] as const)('%s 页签失败显示错误，重试成功清除错误', async (tab, key, index) => {
    mocks[key].mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = render()
    await flushPromises()
    const tabs = wrapper.getComponent({ name: 'ElTabs' })
    tabs.vm.$emit('update:modelValue', tab)
    tabs.vm.$emit('tab-change', tab)
    await flushPromises()
    const target = wrapper.findAllComponents({ name: 'ProTable' })[index]!
    expect(target.props('error')).toBeInstanceOf(Error)
    await (target.props('onRetry') as () => Promise<void>)()
    await flushPromises()
    expect(target.props('error')).toBeNull()
  })

  it('刷新失败时保留已有投递记录并提示数据可能过期', async () => {
    mocks.dispatches.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 })
    const wrapper = render()
    await flushPromises()
    const tabs = wrapper.getComponent({ name: 'ElTabs' })
    tabs.vm.$emit('update:modelValue', 'dispatches')
    tabs.vm.$emit('tab-change', 'dispatches')
    await flushPromises()
    const target = wrapper.findAllComponents({ name: 'ProTable' })[2]!
    expect(target.props('data')).toEqual([{ id: 1 }])

    mocks.dispatches.mockRejectedValueOnce(new Error('unavailable'))
    await (target.props('onRetry') as () => Promise<void>)()
    await flushPromises()
    expect(target.props('data')).toEqual([{ id: 1 }])
    expect(
      wrapper.find('el-alert-stub[title="filePipelineObservability.recordsLoadFailed"]').exists(),
    ).toBe(true)
  })

  it('切换页签后旧投递响应不会覆盖错误记录的总数', async () => {
    let resolveDispatch!: (value: { items: never[]; total: number }) => void
    mocks.dispatches.mockReturnValueOnce(
      new Promise<{ items: never[]; total: number }>((resolve) => {
        resolveDispatch = resolve
      }),
    )
    mocks.errors.mockResolvedValueOnce({ items: [], total: 2 })
    const wrapper = render()
    await flushPromises()
    const tabs = wrapper.getComponent({ name: 'ElTabs' })
    tabs.vm.$emit('update:modelValue', 'dispatches')
    tabs.vm.$emit('tab-change', 'dispatches')
    tabs.vm.$emit('update:modelValue', 'errors')
    tabs.vm.$emit('tab-change', 'errors')
    await flushPromises()
    resolveDispatch({ items: [], total: 99 })
    await flushPromises()
    const errorsTable = wrapper.findAllComponents({ name: 'ProTable' })[3]!
    expect(errorsTable.props('total')).toBe(2)
  })

  it('刷新请求失败时不显示成功提示', async () => {
    const wrapper = render()
    await flushPromises()
    const tabs = wrapper.getComponent({ name: 'ElTabs' })
    tabs.vm.$emit('update:modelValue', 'dispatches')
    tabs.vm.$emit('tab-change', 'dispatches')
    await flushPromises()
    mocks.dispatches.mockRejectedValueOnce(new Error('unavailable'))
    wrapper.findAllComponents({ name: 'ListPageQueryBar' })[2]!.vm.$emit('refresh')
    await flushPromises()
    expect(mocks.message).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents({ name: 'ProTable' })[2]!.props('error')).toBeInstanceOf(Error)
  })
})
