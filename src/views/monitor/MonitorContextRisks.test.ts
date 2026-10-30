// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import Detail from './JobInstanceDetail.vue'
import WorkflowList from './WorkflowRunList.vue'
import Alerts from '../observability/AlertList.vue'

const mocks = vi.hoisted(() => ({
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
  route: null as unknown as { params: { id: string }; query: Record<string, string> },
  detail: vi.fn(),
  cancel: vi.fn(),
  terminate: vi.fn(),
  retryParts: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
  alerts: vi.fn(),
  ack: vi.fn(),
  silence: vi.fn(),
  close: vi.fn(),
  defs: vi.fn(),
  runs: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (k: string) => k, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { username: 'operator', userId: 'user' },
    hasPermission: (role: string) => mocks.state.writer && role === 'ROLE_ADMIN',
  }),
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => mocks.state.writer),
    canWriteSystem: computed(() => mocks.state.writer && !mocks.state.writesFrozen),
    canMutateConfig: computed(() => mocks.state.writer && !mocks.state.writesFrozen),
  }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/composables/useCreateSuccess', () => ({ showCreateSuccess: vi.fn() }))
vi.mock('@/composables/useSavedFilters', () => ({ useSavedFilters: () => ({ sets: ref([]) }) }))
vi.mock('@/composables/useSseAutoReload', () => ({
  useSseAutoReload: () => ({
    status: ref('live'),
    lastRefreshedAt: ref(null),
    markRefreshed: vi.fn(),
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/api/instance', () => ({
  instanceApi: {
    detail: mocks.detail,
    cancel: mocks.cancel,
    terminate: mocks.terminate,
    retryFailedPartitions: mocks.retryParts,
    partitions: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ records: [] }),
    workflowRuns: mocks.runs,
  },
}))
vi.mock('@/api/clusterDiagnostic', () => ({ diagnoseJobInstance: vi.fn().mockResolvedValue({}) }))
vi.mock('@/api/alertsQuery', () => ({ queryAlertsPage: mocks.alerts }))
vi.mock('@/api/alertsCommands', () => ({
  acknowledgeAlert: mocks.ack,
  silenceAlert: mocks.silence,
  closeAlert: mocks.close,
}))
vi.mock('@/api/workflowQueries', () => ({ queryWorkflowDefinitions: mocks.defs }))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { prompt: mocks.prompt },
}))
enableAutoUnmount(afterEach)
const pass = {
  template: '<section><slot /><slot name="actions" /><slot name="footer" /></section>',
}
const stubs = {
  PageContainer: pass,
  PageHeader: pass,
  ElTooltip: pass,
  ElButton: { template: '<button><slot /></button>' },
  RouterLink: true,
}
function renderDetail() {
  return shallowMount(Detail, { global: { stubs } })
}
function renderAlerts() {
  return shallowMount(Alerts, { global: { stubs } })
}
function alert(id: number) {
  return {
    id,
    title: 'Alert-' + id,
    status: 'OPEN',
    severity: 'WARNING',
    alertType: 'TASK',
    detailJson: '{}',
  }
}
function detail(id: number, status: string) {
  return {
    id,
    instanceNo: 'I-' + id,
    jobCode: 'JOB',
    bizDate: '2026-10-26',
    instanceStatus: status,
    paramsSnapshot: '{}',
  }
}
async function click(wrapper: ReturnType<typeof renderDetail>, label: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === label)!
    .trigger('click')
}

beforeEach(() => {
  mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
  mocks.route = reactive({ params: { id: '41' }, query: {} })
  mocks.detail.mockReset().mockImplementation(async (id: number) => detail(id, 'RUNNING'))
  for (const fn of [
    mocks.cancel,
    mocks.terminate,
    mocks.retryParts,
    mocks.ack,
    mocks.close,
    mocks.silence,
  ])
    fn.mockReset().mockResolvedValue({ status: 'CANCEL_REQUESTED' })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.prompt.mockReset().mockResolvedValue({ value: '' })
  mocks.alerts
    .mockReset()
    .mockImplementation(async (_tenant: string, _page: number, size: number) => ({
      items: size === 1 ? [] : [alert(41)],
      total: size === 1 ? 0 : 1,
    }))
  mocks.defs.mockReset().mockResolvedValue([{ id: 1, workflowCode: 'WF' }])
  mocks.runs.mockReset().mockResolvedValue({ records: [], total: 0 })
})

describe('实例详情危险操作目标', () => {
  it.each([
    ['monitor.detailCancelRequestBtn', 'cancel', 'RUNNING'],
    ['monitor.detailTerminateBtn', 'terminate', 'RUNNING'],
    ['monitor.detailRetryFailedPartitions', 'retryParts', 'FAILED'],
  ] as const)('确认期间切租户禁止继续执行：%s', async (label, method, status) => {
    mocks.detail.mockImplementation(async (id: number) => detail(id, status))
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = renderDetail()
    await flushPromises()
    await click(wrapper, label)
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    confirm()
    await flushPromises()
    expect(mocks[method]).not.toHaveBeenCalled()
  })
  it('确认期间切到另一实例，不能对离开的实例提交终止', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = renderDetail()
    await flushPromises()
    await click(wrapper, 'monitor.detailTerminateBtn')
    mocks.route.params.id = '42'
    await flushPromises()
    confirm()
    await flushPromises()
    expect(mocks.terminate).not.toHaveBeenCalled()
  })
  it('当前租户正常终止保持原请求身份', async () => {
    const wrapper = renderDetail()
    await flushPromises()
    await click(wrapper, 'monitor.detailTerminateBtn')
    await flushPromises()
    expect(mocks.terminate).toHaveBeenCalledWith(41, 'tenant-a')
  })
})

describe('告警状态操作与查询范围', () => {
  it.each([
    ['alertList.actionAck', 'ack'],
    ['alertList.actionSilence24', 'silence'],
    ['alertList.actionClose', 'close'],
  ] as const)('原因输入期间切租户，停止告警操作：%s', async (label, method) => {
    let reason!: (value: unknown) => void
    mocks.prompt.mockReturnValueOnce(
      new Promise((resolve) => {
        reason = resolve
      }),
    )
    const wrapper = renderAlerts()
    await flushPromises()
    await click(wrapper, label)
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    reason({ value: '原因' })
    await flushPromises()
    expect(mocks[method]).not.toHaveBeenCalled()
  })
  it('切租户后的查询必须使用当前租户，旧响应不能恢复旧列表', async () => {
    let old!: (value: unknown) => void
    mocks.alerts.mockImplementation((tenant: string, _page: number, size: number) => {
      if (size === 1) return Promise.resolve({ items: [], total: 0 })
      if (tenant === 'tenant-a')
        return new Promise((resolve) => {
          old = resolve
        })
      return Promise.resolve({ items: [alert(52)], total: 1 })
    })
    const wrapper = renderAlerts()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    expect(mocks.alerts.mock.calls.some(([tenant]) => tenant === 'tenant-b')).toBe(true)
    old({ items: [alert(41)], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('Alert-52')
    expect(wrapper.text()).not.toContain('Alert-41')
  })
})

describe('告警状态操作合法路径', () => {
  it.each([
    ['alertList.actionAck', 'ack'],
    ['alertList.actionSilence24', 'silence'],
    ['alertList.actionClose', 'close'],
  ] as const)('当前租户的 %s 操作保留正确身份', async (label, method) => {
    const wrapper = renderAlerts()
    await flushPromises()
    await click(wrapper, label)
    await flushPromises()
    expect(mocks[method]).toHaveBeenCalledWith(
      41,
      expect.objectContaining({ tenantId: 'tenant-a', operatorId: 'operator' }),
    )
  })
})

describe('Workflow 运行列表的筛选依赖', () => {
  it('深链首次加载等待定义编码解析，不能按全部 Workflow 发起查询', async () => {
    mocks.route.query = { workflowCode: 'WF', page: '3' }
    let definitions!: (value: unknown) => void
    mocks.defs.mockReturnValueOnce(
      new Promise((resolve) => {
        definitions = resolve
      }),
    )
    const wrapper = shallowMount(WorkflowList, { global: { stubs } })
    await flushPromises()
    expect(mocks.runs).not.toHaveBeenCalled()
    definitions([{ id: 1, workflowCode: 'WF' }])
    await flushPromises()
    expect(mocks.runs).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', workflowDefinitionId: 1, page: 3 }),
    )
    wrapper.unmount()
  })
})
