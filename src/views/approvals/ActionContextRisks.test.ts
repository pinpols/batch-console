// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide, reactive, ref, type ComputedRef } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import Approvals from './components/GeneralApprovalsTab.vue'
import Partitions from '../monitor/PartitionView.vue'
import Waits from '../scheduler/components/DependencyWaitPanel.vue'
import Workflow from '../monitor/WorkflowRunDetail.vue'

const mocks = vi.hoisted(() => ({
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
  route: null as unknown as { params: { id: string }; query: Record<string, string>; name: string },
  runDetail: vi.fn(),
  nodes: vi.fn(),
  runCancel: vi.fn(),
  runTerminate: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  skip: vi.fn(),
  preview: vi.fn(),
  submitReplay: vi.fn(),
  approvals: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  batchApprove: vi.fn(),
  batchReject: vi.fn(),
  partitions: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  waits: vi.fn(),
  action: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn() }) }))
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
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.approvals,
  approveOne: mocks.approve,
  rejectOne: mocks.reject,
  batchApprove: mocks.batchApprove,
  batchReject: mocks.batchReject,
}))
vi.mock('@/api/queries/partitions', () => ({ queryPartitionsPaged: mocks.partitions }))
vi.mock('@/api/instance', () => ({
  instanceApi: {
    cancelPartition: mocks.cancel,
    retryPartition: mocks.retry,
    workflowRunDetail: mocks.runDetail,
  },
}))
vi.mock('@/api/workflowQueries', () => ({ queryWorkflowNodeRunsPaged: mocks.nodes }))
vi.mock('@/api/workflowRuns', () => ({
  cancelWorkflowRun: mocks.runCancel,
  terminateWorkflowRun: mocks.runTerminate,
  pauseWorkflowRun: mocks.pause,
  resumeWorkflowRun: mocks.resume,
  skipWorkflowRunNode: mocks.skip,
  previewWholeWorkflowReplay: mocks.preview,
  submitWholeWorkflowReplay: mocks.submitReplay,
}))
vi.mock('@/api/job', () => ({ jobApi: {} }))
vi.mock('@/api/dependencyWaits', () => ({
  listCalendarDependencyWaits: mocks.waits,
  requestCalendarDependencyWaitAction: mocks.action,
  listJobDependencyWaits: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/persistentWaits', () => ({
  listPersistentWaits: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElNotification: vi.fn(),
  ElMessageBox: { confirm: mocks.confirm, prompt: mocks.prompt },
}))
enableAutoUnmount(afterEach)
const table = defineComponent({
  name: 'ProTable',
  props: ['data'],
  emits: ['selection-change'],
  setup(props, { emit, slots }) {
    provide(
      'current-row',
      computed(() => props.data?.[0]),
    )
    return () =>
      h('section', [
        h(
          'button',
          { class: 'select', onClick: () => emit('selection-change', props.data) },
          '选择',
        ),
        slots.default?.(),
        slots.toolbar?.(),
      ])
  },
})
const column = defineComponent({
  inheritAttrs: false,
  setup(_, { slots }) {
    const row = inject<ComputedRef<unknown>>('current-row')!
    return () => (row?.value ? slots.default?.({ row: row.value }) : null)
  },
})
const rowActions = defineComponent({
  name: 'RowActions',
  props: ['actions'],
  setup(props) {
    return () =>
      h(
        'div',
        props.actions.map((action: { key: string; onClick: () => void; disabled: boolean }) =>
          h(
            'button',
            { class: 'action-' + action.key, disabled: action.disabled, onClick: action.onClick },
            action.key,
          ),
        ),
      )
  },
})
const pass = {
  template: '<section><slot /><slot name="actions" /><slot name="header" /></section>',
}
const stubs = {
  ProTable: table,
  ElTable: table,
  ElTableColumn: column,
  RowActions: rowActions,
  PageContainer: pass,
  PageHeader: pass,
  SectionCard: pass,
  ElTabs: pass,
  ElTabPane: pass,
  BulkActionBar: {
    name: 'BulkActionBar',
    props: ['count'],
    template: '<div><slot :running="false" /></div>',
  },
  ElButton: { template: '<button><slot /></button>' },
  RouterLink: true,
}
function approval(no = 'AP-41') {
  return { approvalNo: no, approvalStatus: 'PENDING', payloadJson: '{}' }
}
function partition(id = 41) {
  return { id, tenantId: 'tenant-a', jobInstanceId: 9, partitionStatus: 'FAILED' }
}
function wait() {
  return {
    id: 41,
    tenantId: 'tenant-a',
    calendarCode: 'CAL',
    bizDate: '2026-10-26',
    waitStatus: 'WAITING',
  }
}
function renderApprovals() {
  return shallowMount(Approvals, { global: { stubs } })
}
function renderPartitions() {
  return shallowMount(Partitions, { global: { stubs } })
}
function renderWaits() {
  return shallowMount(Waits, { global: { stubs } })
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
  mocks.route = reactive({ params: { id: '9' }, query: {}, name: 'workflow-run-detail' })
  mocks.runDetail
    .mockReset()
    .mockImplementation(async (id: number) => ({
      id,
      workflowDefinitionId: 1,
      runStatus: 'RUNNING',
      bizDate: '2026-10-26',
    }))
  mocks.nodes
    .mockReset()
    .mockResolvedValue({
      records: [
        { id: 41, nodeCode: 'job', nodeType: 'JOB', nodeStatus: 'FAILED', jobInstanceId: 10 },
      ],
      total: 1,
    })
  for (const fn of [
    mocks.runCancel,
    mocks.runTerminate,
    mocks.pause,
    mocks.resume,
    mocks.skip,
    mocks.submitReplay,
  ])
    fn.mockReset().mockResolvedValue(undefined)
  mocks.preview
    .mockReset()
    .mockResolvedValue({
      sourceWorkflowRunId: 9,
      bizDate: '2026-10-26',
      nodes: [],
      edges: [],
      operationKey: 'operation-9',
      previewToken: 'preview-9',
    })
  mocks.approvals.mockReset().mockResolvedValue({ items: [approval()], total: 1 })
  mocks.partitions.mockReset().mockResolvedValue({ records: [partition()], total: 1 })
  mocks.waits.mockReset().mockResolvedValue([wait()])
  for (const fn of [mocks.approve, mocks.reject, mocks.cancel, mocks.retry, mocks.action])
    fn.mockReset().mockResolvedValue(undefined)
  for (const fn of [mocks.batchApprove, mocks.batchReject])
    fn.mockReset().mockResolvedValue([{ approvalNo: 'AP-41', success: true }])
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.prompt.mockReset().mockResolvedValue({ value: '复核原因' })
})

describe('审批提交与读取范围', () => {
  it.each(['approve', 'reject'] as const)('原因输入期间切租户不提交旧审批：%s', async (action) => {
    const reason = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(reason.promise)
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.action-' + action).trigger('click')
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    reason.resolve({ value: '原因' })
    await flushPromises()
    expect(mocks[action]).not.toHaveBeenCalled()
  })
  it.each(['approve', 'reject'] as const)('批量确认 A→B→A 后禁止继续提交：%s', async (action) => {
    const confirmation = pending<{ value: string }>()
    if (action === 'approve') mocks.confirm.mockReturnValueOnce(confirmation.promise)
    else mocks.prompt.mockReturnValueOnce(confirmation.promise)
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.select').trigger('click')
    await wrapper
      .findAll('button')
      .find(
        (b) =>
          b.text() === (action === 'approve' ? 'approvals.batchApprove' : 'approvals.batchReject'),
      )!
      .trigger('click')
    mocks.state.tenantId = 'tenant-b'
    mocks.state.tenantId = 'tenant-a'
    confirmation.resolve({ value: '原因' })
    await flushPromises()
    expect(action === 'approve' ? mocks.batchApprove : mocks.batchReject).not.toHaveBeenCalled()
  })
  it('旧租户读取晚到不覆盖当前审批列表', async () => {
    const old = pending<unknown>()
    mocks.approvals
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ items: [approval('AP-52')], total: 1 })
    const wrapper = renderApprovals()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    old.resolve({ items: [approval('AP-41')], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([approval('AP-52')])
  })
  it('当前租户正常审批保持原目标和原因', async () => {
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.action-approve').trigger('click')
    await flushPromises()
    expect(mocks.approve).toHaveBeenCalledWith(
      'AP-41',
      expect.objectContaining({ tenantId: 'tenant-a', reason: '复核原因' }),
    )
  })
})
describe('分区操作上下文', () => {
  it.each(['cancel', 'retry'] as const)('确认后已离开当前实例则不提交：%s', async (action) => {
    const confirmation = pending<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const wrapper = renderPartitions()
    await flushPromises()
    await wrapper.find('.action-' + action).trigger('click')
    mocks.route.params.id = '10'
    await flushPromises()
    confirmation.resolve()
    await flushPromises()
    expect(mocks[action]).not.toHaveBeenCalled()
  })
  it('旧查询晚到不覆盖新实例的分区列表', async () => {
    const old = pending<unknown>()
    mocks.partitions
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ records: [partition(52)], total: 1 })
    const wrapper = renderPartitions()
    await flushPromises()
    mocks.route.params.id = '10'
    await flushPromises()
    old.resolve({ records: [partition(41)], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([partition(52)])
  })
  it('当前租户正常重试仍提交原分区', async () => {
    const wrapper = renderPartitions()
    await flushPromises()
    await wrapper.find('.action-retry').trigger('click')
    await flushPromises()
    expect(mocks.retry).toHaveBeenCalledWith(41, 'tenant-a')
  })
})
describe('日历依赖等待操作上下文', () => {
  it.each([false, true])('原因输入期间租户变化后禁止旧请求：是否回到原租户 %s', async (back) => {
    const reason = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(reason.promise)
    const wrapper = renderWaits()
    await flushPromises()
    wrapper
      .findComponent({ name: 'CalendarDependencyWaitTable' })
      .vm.$emit('request-action', wait(), 'RELEASE')
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    if (back) mocks.state.tenantId = 'tenant-a'
    await flushPromises()
    reason.resolve({ value: '原因' })
    await flushPromises()
    expect(mocks.action).not.toHaveBeenCalled()
  })
  it('当前租户正常解除等待保留原因与幂等键', async () => {
    const wrapper = renderWaits()
    await flushPromises()
    wrapper
      .findComponent({ name: 'CalendarDependencyWaitTable' })
      .vm.$emit('request-action', wait(), 'RELEASE')
    await flushPromises()
    expect(mocks.action).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        calendarCode: 'CAL',
        action: 'RELEASE',
        reason: '复核原因',
      }),
      expect.any(String),
    )
  })
})

describe('审批和分区的可用性反例', () => {
  it.each(['approve', 'reject'] as const)('当前批量 %s 正常提交', async (action) => {
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.select').trigger('click')
    await wrapper
      .findAll('button')
      .find(
        (b) =>
          b.text() === (action === 'approve' ? 'approvals.batchApprove' : 'approvals.batchReject'),
      )!
      .trigger('click')
    await flushPromises()
    expect(action === 'approve' ? mocks.batchApprove : mocks.batchReject).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', approvalNos: ['AP-41'] }),
    )
  })
  it('审批原因输入期间写权限失效，不提交写入', async () => {
    const reason = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(reason.promise)
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.action-approve').trigger('click')
    mocks.state.writer = false
    reason.resolve({ value: '原因' })
    await flushPromises()
    expect(mocks.approve).not.toHaveBeenCalled()
  })
  it('审批页清空租户立即清除列表和选择', async () => {
    const wrapper = renderApprovals()
    await flushPromises()
    await wrapper.find('.select').trigger('click')
    mocks.state.tenantId = ''
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([])
    expect(wrapper.findComponent({ name: 'BulkActionBar' }).props('count')).toBe(0)
  })
  it('当前分区查询失败显示错误，不产生未处理 rejection', async () => {
    mocks.partitions.mockRejectedValueOnce(new Error('读取分区失败'))
    const wrapper = renderPartitions()
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElAlert' }).attributes('title')).toBeTruthy()
  })
  it('依赖等待输入原因期间进入维护，禁止解除等待', async () => {
    const reason = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(reason.promise)
    const wrapper = renderWaits()
    await flushPromises()
    wrapper
      .findComponent({ name: 'CalendarDependencyWaitTable' })
      .vm.$emit('request-action', wait(), 'RELEASE')
    await flushPromises()
    mocks.state.writesFrozen = true
    reason.resolve({ value: '原因' })
    await flushPromises()
    expect(mocks.action).not.toHaveBeenCalled()
  })
})

describe('Workflow 详情的请求代次与操作目标', () => {
  it.each([
    ['monitor.runDetailCancel', 'runCancel'],
    ['monitor.runDetailTerminate', 'runTerminate'],
    ['runControl.pause', 'pause'],
  ] as const)('确认期间租户 A→B→A 禁止原操作：%s', async (label, method) => {
    const confirmation = pending<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const wrapper = shallowMount(Workflow, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === label)!
      .trigger('click')
    mocks.state.tenantId = 'tenant-b'
    mocks.state.tenantId = 'tenant-a'
    await flushPromises()
    confirmation.resolve()
    await flushPromises()
    expect(mocks[method]).not.toHaveBeenCalled()
  })
  it('跳过节点的原因输入期间离开又返回，不继续原确认', async () => {
    const reason = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(reason.promise)
    const wrapper = shallowMount(Workflow, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'monitor.nodeActionSkip')!
      .trigger('click')
    mocks.route.params.id = '10'
    mocks.route.params.id = '9'
    await flushPromises()
    reason.resolve({ value: '原因' })
    await flushPromises()
    expect(mocks.skip).not.toHaveBeenCalled()
  })
  it('旧节点查询晚到不覆盖新运行', async () => {
    const old = pending<unknown>()
    mocks.nodes
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({
        records: [{ id: 52, nodeCode: 'new', nodeStatus: 'SUCCESS' }],
        total: 1,
      })
    const wrapper = shallowMount(Workflow, { global: { stubs } })
    await flushPromises()
    mocks.route.params.id = '10'
    await flushPromises()
    old.resolve({ records: [{ id: 41, nodeCode: 'old', nodeStatus: 'FAILED' }], total: 1 })
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([
      { id: 52, nodeCode: 'new', nodeStatus: 'SUCCESS' },
    ])
  })
  it('旧重放预览晚到不弹出离开运行的危险确认', async () => {
    mocks.runDetail.mockImplementation(async (id: number) => ({
      id,
      workflowDefinitionId: 1,
      runStatus: 'FAILED',
      bizDate: '2026-10-26',
    }))
    const preview = pending<unknown>()
    mocks.preview.mockReturnValueOnce(preview.promise)
    const wrapper = shallowMount(Workflow, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'monitor.replayWholeWorkflowButton')!
      .trigger('click')
    mocks.route.params.id = '10'
    await flushPromises()
    preview.resolve({
      sourceWorkflowRunId: 9,
      nodes: [],
      edges: [],
      operationKey: 'op-9',
      previewToken: 'p-9',
    })
    await flushPromises()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.submitReplay).not.toHaveBeenCalled()
  })
  it('当前运行正常取消仍可提交', async () => {
    const wrapper = shallowMount(Workflow, { global: { stubs } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'monitor.runDetailCancel')!
      .trigger('click')
    await flushPromises()
    expect(mocks.runCancel).toHaveBeenCalledWith(9, 'tenant-a')
  })
})
