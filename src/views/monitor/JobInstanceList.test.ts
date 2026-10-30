// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import JobInstanceList from './JobInstanceList.vue'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  jobs: vi.fn(),
  republish: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { username: 'operator' },
    hasPermission: (role: string) => mocks.state.writer && role === 'ROLE_ADMIN',
  }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/useSseAutoReload', () => ({
  useSseAutoReload: () => ({
    status: ref('live'),
    lastRefreshedAt: ref(null),
    markRefreshed: vi.fn(),
  }),
}))
vi.mock('@/api/instance', () => ({
  instanceApi: { list: mocks.page, retry: mocks.republish, cancel: mocks.cancel },
}))
vi.mock('@/api/job', () => ({ jobApi: { listDefinitionsPaged: mocks.jobs } }))
vi.mock('@/composables/useSavedFilters', () => ({ useSavedFilters: () => ({ sets: ref([]) }) }))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: mocks.confirm },
}))
enableAutoUnmount(afterEach)
const table = defineComponent({
  name: 'ProTable',
  props: ['data'],
  emits: ['selection-change'],
  setup(props, { emit, slots }) {
    return () =>
      h('section', [
        h(
          'button',
          { class: 'select-rows', onClick: () => emit('selection-change', props.data) },
          '选择当前页',
        ),
        slots.toolbar?.(),
      ])
  },
})
function row(id: number, status = 'FAILED') {
  return {
    id,
    instanceNo: 'I-' + id,
    jobCode: 'JOB',
    bizDate: '2026-10-26',
    instanceStatus: status,
  }
}
function render() {
  return shallowMount(JobInstanceList, {
    global: {
      stubs: {
        PageContainer: { template: '<main><slot /></main>' },
        OpsFilterToolbar: { template: '<section><slot /><slot name="status" /></section>' },
        ElSelect: { template: '<div><slot /></div>' },
        ElOption: { name: 'ElOption', props: ['label'], template: '<span />' },
        RouterLink: true,
        ProTable: table,
        BulkActionBar: { template: '<div><slot :running="false" /></div>' },
        ElButton: { template: '<button><slot /></button>' },
      },
    },
  })
}
async function selectAndSubmit(wrapper: ReturnType<typeof render>, action = 'bulkRetry') {
  await wrapper.find('.select-rows').trigger('click')
  const button = wrapper.findAll('button').find((b) => b.text() === `jobInstanceList.${action}`)!
  await button.trigger('click')
}

describe('作业实例列表的读取与批量操作上下文', () => {
  beforeEach(() => {
    mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
    mocks.jobs.mockReset().mockResolvedValue({ records: [] })
    mocks.page.mockReset().mockResolvedValue({ records: [row(41)], total: 1 })
    mocks.republish.mockReset().mockResolvedValue(undefined)
    mocks.cancel.mockReset().mockResolvedValue(undefined)
    mocks.confirm.mockReset().mockResolvedValue(undefined)
    vi.mocked(ElMessage.success).mockClear()
    vi.mocked(ElMessage.error).mockClear()
  })

  it('旧租户列表晚到不覆盖新租户，也不影响当前加载状态', async () => {
    let finishOld!: (value: unknown) => void
    mocks.page.mockImplementation((query: { tenantId: string; pageSize: number }) => {
      if (query.pageSize === 1) return Promise.resolve({ records: [], total: 0 })
      if (query.tenantId === 'tenant-a')
        return new Promise((resolve) => {
          finishOld = resolve
        })
      return Promise.resolve({ records: [row(52)], total: 1 })
    })
    const wrapper = render()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ records: [row(41)], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([row(52)])
  })

  it('确认期间 A 到 B 再到 A，旧确认不能继续提交', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    mocks.state.tenantId = 'tenant-b'
    mocks.state.tenantId = 'tenant-a'
    confirm()
    await flushPromises()
    expect(mocks.republish).not.toHaveBeenCalled()
  })

  it('切换租户后停止批量排队项，旧结果不在新租户弹出', async () => {
    mocks.page.mockResolvedValue({
      records: Array.from({ length: 6 }, (_, i) => row(i + 1)),
      total: 6,
    })
    let finish!: () => void
    mocks.republish.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledTimes(4)
    mocks.state.tenantId = 'tenant-b'
    finish()
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledTimes(4)
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(false)
  })

  it('清空租户立即清除旧列表，不显示上一租户业务数据', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.state.tenantId = ''
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([])
  })

  it('旧租户状态计数晚到不能覆盖新租户计数', async () => {
    const oldCounts: Array<(value: unknown) => void> = []
    mocks.page.mockImplementation((query: { tenantId: string; pageSize: number }) => {
      if (query.pageSize !== 1) return Promise.resolve({ records: [row(41)], total: 1 })
      if (query.tenantId === 'tenant-a') return new Promise((resolve) => oldCounts.push(resolve))
      return Promise.resolve({ records: [], total: 2 })
    })
    const wrapper = render()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    for (const resolve of oldCounts) resolve({ records: [], total: 9 })
    await flushPromises()
    const items = wrapper.findComponent({ name: 'StatusSegment' }).props('items') as Array<{
      count: number
    }>
    expect(items.map((item) => item.count)).toEqual([2, 2, 2, 2, 2])
  })

  it('旧租户作业提示晚到不能覆盖新租户选项', async () => {
    let finishOld!: (value: unknown) => void
    mocks.jobs.mockImplementation((query: { tenantId: string }) =>
      query.tenantId === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ records: [{ jobCode: 'JOB-B' }] }),
    )
    const wrapper = render()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ records: [{ jobCode: 'JOB-A' }] })
    await flushPromises()
    const labels = wrapper
      .findAllComponents({ name: 'ElOption' })
      .map((option) => option.props('label'))
    expect(labels).toContain('JOB-B')
    expect(labels).not.toContain('JOB-A')
  })

  it('同一租户正常批量重试保留成功汇总', async () => {
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper)
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledWith('I-41', 'tenant-a', 'JOB', '2026-10-26')
    expect(ElMessage.success).toHaveBeenCalledOnce()
    expect(wrapper.findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(true)
  })

  it('取消确认期间切换租户，不能取消原租户的目标', async () => {
    mocks.page.mockResolvedValue({ records: [row(41, 'RUNNING')], total: 1 })
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper, 'bulkCancel')
    mocks.state.tenantId = 'tenant-b'
    confirm()
    await flushPromises()
    expect(mocks.cancel).not.toHaveBeenCalled()
  })

  it('当前租户正常批量取消保持既有请求身份', async () => {
    mocks.page.mockResolvedValue({ records: [row(41, 'RUNNING')], total: 1 })
    const wrapper = render()
    await flushPromises()
    await selectAndSubmit(wrapper, 'bulkCancel')
    await flushPromises()
    expect(mocks.cancel).toHaveBeenCalledWith(41, 'tenant-a')
    expect(ElMessage.success).toHaveBeenCalledOnce()
  })
})
