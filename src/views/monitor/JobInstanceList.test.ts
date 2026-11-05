// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  reactive,
  ref,
  type Component,
  type Ref,
} from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import JobInstanceList from './JobInstanceList.vue'
import TraceIdInput from '@/components/common/TraceIdInput.vue'

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  jobs: vi.fn(),
  republish: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  route: { query: {} as Record<string, string> },
  replace: vi.fn(),
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    profileLoaded: true,
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
  ElMessage: Object.assign(vi.fn(), { success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
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
function render(extraStubs: Record<string, Component | boolean> = {}) {
  return shallowMount(JobInstanceList, {
    global: {
      stubs: {
        PageContainer: { template: '<main><slot /></main>' },
        OpsFilterToolbar: { template: '<section><slot /><slot name="status" /></section>' },
        ElSelect: { name: 'ElSelect', template: '<div><slot /></div>' },
        ElOption: { name: 'ElOption', props: ['label'], template: '<span />' },
        ElTag: { template: '<span><slot /></span>' },
        RouterLink: true,
        ProTable: table,
        BulkActionBar: { template: '<div><slot :running="false" /></div>' },
        ElButton: { template: '<button><slot /></button>' },
        ...extraStubs,
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
    mocks.route.query = {}
    mocks.replace.mockReset()
    mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
    mocks.jobs.mockReset().mockResolvedValue({ records: [] })
    mocks.page.mockReset().mockResolvedValue({ records: [row(41)], total: 1 })
    mocks.republish.mockReset().mockResolvedValue(undefined)
    mocks.cancel.mockReset().mockResolvedValue(undefined)
    mocks.confirm.mockReset().mockResolvedValue(undefined)
    vi.mocked(ElMessage.success).mockClear()
    vi.mocked(ElMessage.error).mockClear()
  })

  it('详情深链的精确编码贯穿列表和状态计数，编辑编码后恢复模糊查询', async () => {
    vi.mocked(ElMessage).mockClear()
    mocks.route.query = { exactJobCode: 'JOB_A', range: 'all' }
    const wrapper = render()
    await flushPromises()
    expect(mocks.page).toHaveBeenCalledWith(
      expect.objectContaining({ exactJobCode: 'JOB_A', pageSize: 15 }),
    )
    expect(mocks.page).toHaveBeenCalledWith(
      expect.objectContaining({ exactJobCode: 'JOB_A', pageSize: 1 }),
    )
    expect(wrapper.text()).toContain('jobInstanceList.exactJobCodeHint')

    mocks.page.mockClear()
    const input = wrapper.getComponent({ name: 'ElSelect' })
    input.vm.$emit('update:modelValue', 'JOB_B')
    input.vm.$emit('change', 'JOB_B')
    await flushPromises()
    expect(mocks.page).toHaveBeenCalledWith(
      expect.objectContaining({ jobCode: 'JOB_B', exactJobCode: '' }),
    )
    expect(mocks.replace).toHaveBeenCalledWith({ query: { jobCode: 'JOB_B', range: 'all' } })
    await vi.waitFor(() => expect(ElMessage).toHaveBeenCalledOnce())
  })

  it('uses Enter to search the trace filter without enabling diagnostic navigation', async () => {
    vi.mocked(ElMessage).mockClear()
    const wrapper = render()
    await flushPromises()
    const input = wrapper.getComponent(TraceIdInput)
    expect(input.props('goTo')).toBe(false)
    input.vm.$emit('update:modelValue', 'trace-filter-value')
    await input.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.page).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-filter-value' }),
    )
    await vi.waitFor(() => expect(ElMessage).toHaveBeenCalledOnce())
  })

  it('队列和 Worker 组可分别查看完整值，空值仍显示占位符', async () => {
    const queueCode = `queue-${'q'.repeat(100)}`
    const workerGroup = `worker-${'w'.repeat(100)}`
    mocks.page.mockResolvedValue({
      records: [{ ...row(41), queueCode, workerGroup }, row(42)],
      total: 2,
    })
    const queueTable = defineComponent({
      props: ['data'],
      setup(props, { slots }) {
        provide(
          'queueTestRows',
          computed(() => props.data ?? []),
        )
        return () =>
          h('section', slots.default?.({ isColVisible: (key: string) => key === 'queueGroup' }))
      },
    })
    const queueColumn = defineComponent({
      props: ['label'],
      setup(props, { slots }) {
        const rows = inject<Ref<Array<Record<string, unknown>>>>('queueTestRows')!
        return () =>
          props.label === 'jobInstanceList.colQueueGroup'
            ? h(
                'div',
                rows.value.map((item) =>
                  h('div', { class: 'queue-row' }, slots.default?.({ row: item })),
                ),
              )
            : null
      },
    })
    const popover = defineComponent({
      setup(_props, { expose, slots }) {
        const open = ref(false)
        expose({
          hide: () => {
            open.value = false
          },
        })
        return () =>
          h(
            'span',
            {
              onClickCapture: () => {
                open.value = !open.value
              },
            },
            [slots.reference?.(), open.value ? slots.default?.() : null],
          )
      },
    })
    const wrapper = render({
      ProTable: queueTable,
      ElTableColumn: queueColumn,
      CopyableText: false,
      ElPopover: popover,
    })
    await flushPromises()
    const rows = wrapper.findAll('.queue-row')
    expect(rows).toHaveLength(2)
    const buttons = rows[0]!.findAll('button[aria-label="common.viewFullValue"]')
    expect(buttons).toHaveLength(2)
    await buttons[0]!.trigger('click')
    expect(rows[0]!.get('.copyable-text__full-value').text()).toBe(queueCode)
    await buttons[1]!.trigger('click')
    expect(rows[0]!.findAll('.copyable-text__full-value').map((item) => item.text())).toEqual([
      queueCode,
      workerGroup,
    ])
    expect(rows[1]!.text()).toContain('—')
    expect(rows[1]!.find('button').exists()).toBe(false)
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

describe('作业运行空表文案', () => {
  const emptyTable = defineComponent({
    name: 'ProTable',
    setup(_, { slots }) {
      return () => h('section', slots.empty?.())
    },
  })
  const ListEmptyState = {
    name: 'ListEmptyState',
    props: ['filtered', 'actionText'],
    template: '<div class="empty" :data-filtered="String(filtered)">{{ actionText }}</div>',
  }

  beforeEach(() => {
    mocks.route.query = {}
    mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
    mocks.jobs.mockReset().mockResolvedValue({ records: [] })
  })

  it('按状态筛选无结果但租户有运行时，提示筛选无结果并可重置，不引导去定义作业', async () => {
    mocks.route.query = { status: 'FAILED' }
    mocks.page
      .mockReset()
      .mockImplementation(async (params: { instanceStatus?: string }) =>
        params.instanceStatus ? { records: [], total: 0 } : { records: [], total: 21 },
      )
    const wrapper = render({ ProTable: emptyTable, ListEmptyState })
    await flushPromises()
    expect(wrapper.get('.empty').attributes('data-filtered')).toBe('true')
  })

  it('无筛选且租户没有任何运行时，引导去定义作业', async () => {
    mocks.page.mockReset().mockResolvedValue({ records: [], total: 0 })
    const wrapper = render({ ProTable: emptyTable, ListEmptyState })
    await flushPromises()
    const empty = wrapper.get('.empty')
    expect(empty.attributes('data-filtered')).toBe('false')
    expect(empty.text()).toContain('jobInstanceList.emptyGoDefinitions')
  })
})
