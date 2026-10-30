// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import Workers from './WorkerManagement.vue'
import Snapshot from '../scheduler/SchedulerSnapshot.vue'
const mocks = vi.hoisted(() => ({
  state: null as unknown as {
    tenantId: string
    writer: boolean
    writesFrozen: boolean
    workerStatus: string
  },
  confirm: vi.fn(),
  drain: vi.fn(),
  offline: vi.fn(),
  takeover: vi.fn(),
  warmup: vi.fn(),
  channels: vi.fn(),
  snapshot: vi.fn(),
  history: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: { id?: string }) => (params?.id ? key + ':' + params.id : key),
    te: () => false,
  }),
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
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}))
vi.mock('@/composables/queries/useWorkers', () => ({
  useWorkers: () => ({
    data: computed(() => [
      { workerCode: 'worker-a', status: mocks.state.workerStatus, capabilities: [] },
    ]),
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
    refetch: vi.fn().mockResolvedValue({}),
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
  useMetaWorkerGroupsQuery: () => ({ data: ref([]) }),
}))
vi.mock('@/composables/useSseAutoReload', () => ({
  useSseAutoReload: () => ({
    status: ref('live'),
    lastRefreshedAt: ref(null),
    markRefreshed: vi.fn(),
  }),
}))
vi.mock('@/api/workers', () => ({
  drainWorker: mocks.drain,
  forceWorkerOffline: mocks.offline,
  takeoverWorker: mocks.takeover,
  warmupWorker: mocks.warmup,
  listWorkerClaimedTasks: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/fileChannelsQuery', () => ({ queryFileChannels: mocks.channels }))
vi.mock('@/api/meta', () => ({ getMetaEnums: vi.fn().mockResolvedValue({}) }))
vi.mock('@/api/scheduler', () => ({
  getSchedulerSnapshot: mocks.snapshot,
  getSchedulerSnapshotHistory: mocks.history,
  getSchedulerStatus: vi.fn().mockResolvedValue({ status: 'RUNNING' }),
  pauseAllSchedulers: vi.fn(),
  resumeAllSchedulers: vi.fn(),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { confirm: mocks.confirm },
}))
enableAutoUnmount(afterEach)
const pass = {
  template: '<section><slot /><slot name="actions" /><slot name="header" /></section>',
}
const stubs = {
  ElTag: pass,
  PageContainer: pass,
  PageHeader: pass,
  SectionCard: pass,
  ElTabs: { name: 'ElTabs', props: ['modelValue'], template: '<div><slot /></div>' },
  ElTabPane: pass,
  ElButton: { name: 'ElButton', props: ['loading'], template: '<button><slot /></button>' },
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function snapshot(tenantId: string) {
  return { tenantId, generatedAt: '2026-10-26T12:00:00Z', policies: [], queues: [], workers: [] }
}
function renderWorkers() {
  return shallowMount(Workers, { global: { stubs } })
}
function renderSnapshot() {
  return shallowMount(Snapshot, { global: { stubs } })
}
async function click(wrapper: ReturnType<typeof renderWorkers>, label: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === label)!
    .trigger('click')
}
beforeEach(() => {
  mocks.state = reactive({
    tenantId: 'tenant-a',
    writer: true,
    writesFrozen: false,
    workerStatus: 'ONLINE',
  })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  for (const fn of [mocks.drain, mocks.offline, mocks.takeover, mocks.warmup, mocks.invalidate])
    fn.mockReset().mockResolvedValue(undefined)
  mocks.channels.mockReset().mockResolvedValue([])
  mocks.snapshot.mockReset().mockImplementation(async (tenantId: string) => snapshot(tenantId))
  mocks.history.mockReset().mockResolvedValue([])
})
describe('Worker 操作的租户身份', () => {
  it.each([
    ['actionDrain', 'drain'],
    ['actionOffline', 'offline'],
    ['actionTakeover', 'takeover'],
  ] as const)('确认期间切租户不提交旧 Worker：%s', async (label, method) => {
    const confirmation = pending<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.' + label)
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    confirmation.resolve()
    await flushPromises()
    expect(mocks[method]).not.toHaveBeenCalled()
  })
  it('当前 Worker 正常排空保持原租户', async () => {
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.actionDrain')
    await flushPromises()
    expect(mocks.drain).toHaveBeenCalledWith(
      'worker-a',
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
  })
  it('旧渠道列表晚到不覆盖新租户渠道', async () => {
    const old = pending<unknown>()
    mocks.channels
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue([{ id: 52, channelCode: 'channel-b' }])
    const wrapper = renderWorkers()
    await flushPromises()
    wrapper.findComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'channels')
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    old.resolve([{ id: 41, channelCode: 'channel-a' }])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ProTable' }).props('data')).toEqual([
      { id: 52, channelCode: 'channel-b' },
    ])
  })
})
describe('调度快照读取范围', () => {
  it('旧租户快照晚到不覆盖当前租户', async () => {
    const old = pending<unknown>()
    mocks.snapshot.mockReturnValueOnce(old.promise)
    const wrapper = renderSnapshot()
    await flushPromises()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    old.resolve(snapshot('tenant-a'))
    await flushPromises()
    expect(wrapper.text()).toContain('schedulerSnapshot.tenantLabel:tenant-b')
    expect(wrapper.text()).not.toContain('schedulerSnapshot.tenantLabel:tenant-a')
  })
  it('清空租户同步清除原快照', async () => {
    const wrapper = renderSnapshot()
    await flushPromises()
    mocks.state.tenantId = ''
    await flushPromises()
    expect(wrapper.text()).not.toContain('schedulerSnapshot.tenantLabel:tenant-a')
  })
})

describe('Worker 操作的正常与变化路径', () => {
  it.each([
    ['actionOffline', 'offline'],
    ['actionTakeover', 'takeover'],
  ] as const)('当前 Worker 的 %s 正常提交', async (label, method) => {
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.' + label)
    await flushPromises()
    expect(mocks[method]).toHaveBeenCalledWith(
      'worker-a',
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
  })
  it('离线 Worker 可正常预热，返回后刷新原租户缓存', async () => {
    mocks.state.workerStatus = 'OFFLINE'
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.actionWarmup')
    await flushPromises()
    expect(mocks.warmup).toHaveBeenCalledWith('worker-a', 'tenant-a')
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['workers', 'tenant-a'] })
  })
  it('确认期间写权限失效，禁止 Worker 接管', async () => {
    const confirmation = pending<void>()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.actionTakeover')
    mocks.state.writer = false
    confirmation.resolve()
    await flushPromises()
    expect(mocks.takeover).not.toHaveBeenCalled()
  })
  it('请求已发出后切租户，旧返回不刷新新租户缓存', async () => {
    const response = pending<void>()
    mocks.drain.mockReturnValueOnce(response.promise)
    const wrapper = renderWorkers()
    await flushPromises()
    await click(wrapper, 'workerManagement.actionDrain')
    await flushPromises()
    expect(mocks.drain).toHaveBeenCalledWith(
      'worker-a',
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
    mocks.state.tenantId = 'tenant-b'
    response.resolve()
    await flushPromises()
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
