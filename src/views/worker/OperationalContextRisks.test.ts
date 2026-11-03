// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'
import Workers from './WorkerManagement.vue'
import Snapshot from '../scheduler/SchedulerSnapshot.vue'
const mocks = vi.hoisted(() => ({
  state: null as unknown as {
    tenantId: string
    writer: boolean
    writesFrozen: boolean
    workerStatus: string
    workerPending: boolean
    workerError: Error | null
    workerRowsPresent: boolean
    workerDataAvailable: boolean
    workerDataTenant: string
    fileMenu: string[]
    loggedIn: boolean
    profileLoaded: boolean
    workerMenu: boolean
    username: string
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
  workerMeta: [] as { value: string; label: string }[],
  translate: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: mocks.translate,
    te: (key: string) => key === 'enum.workerStatus.DECOMMISSIONED',
  }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({
    hasBackendMenuAccess: (path: string) =>
      path === '/workers/management' ? mocks.state.workerMenu : mocks.state.fileMenu.includes(path),
    canAccessRole: () => mocks.state.workerMenu,
  }),
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get profileLoaded() {
      return mocks.state.profileLoaded
    },
    get isLoggedIn() {
      return mocks.state.loggedIn
    },
    get userInfo() {
      return { username: mocks.state.username }
    },
    hasPermission: (role: string) => mocks.state.writer && role === 'ROLE_ADMIN',
  }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}))
vi.mock('@/composables/queries/useWorkers', () => ({
  useWorkers: () => ({
    data: computed(() =>
      !mocks.state.workerDataAvailable || mocks.state.workerDataTenant !== mocks.state.tenantId
        ? undefined
        : mocks.state.workerRowsPresent
          ? [{ workerCode: 'worker-a', status: mocks.state.workerStatus, capabilities: [] }]
          : [],
    ),
    isPending: computed(() => mocks.state.workerPending),
    isFetching: ref(false),
    error: computed(() => mocks.state.workerError),
    refetch: vi.fn().mockResolvedValue({}),
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: computed(() => ({ workerStatus: mocks.workerMeta })) }),
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
  ListPageQueryBar: pass,
  ElTabs: { name: 'ElTabs', props: ['modelValue'], template: '<div><slot /></div>' },
  ElTabPane: { name: 'ElTabPane', ...pass },
  ElFormItem: pass,
  StatusSegment: { name: 'StatusSegment', props: ['items'], template: '<div />' },
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
function renderWorkers(realTabs = false) {
  return shallowMount(Workers, {
    global: { stubs: realTabs ? { ...stubs, ElTabs: false, ElTabPane: false } : stubs },
  })
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
  mocks.translate
    .mockReset()
    .mockImplementation((key: string, params?: { id?: string }) =>
      params?.id ? key + ':' + params.id : key,
    )
  mocks.workerMeta = []
  mocks.state = reactive({
    tenantId: 'tenant-a',
    writer: true,
    writesFrozen: false,
    workerStatus: 'ONLINE',
    workerPending: false,
    workerError: null,
    workerRowsPresent: true,
    workerDataAvailable: true,
    workerDataTenant: 'tenant-a',
    fileMenu: [],
    loggedIn: true,
    profileLoaded: true,
    workerMenu: true,
    username: 'operator',
  })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  for (const fn of [mocks.drain, mocks.offline, mocks.takeover, mocks.warmup, mocks.invalidate])
    fn.mockReset().mockResolvedValue(undefined)
  mocks.channels.mockReset().mockResolvedValue([])
  mocks.snapshot.mockReset().mockImplementation(async (tenantId: string) => snapshot(tenantId))
  mocks.history.mockReset().mockResolvedValue([])
})
describe('Worker 操作的租户身份', () => {
  it('身份失效时隐藏渠道查询并丢弃迟到响应', async () => {
    const old = pending<unknown>()
    mocks.channels.mockReturnValueOnce(old.promise)
    const wrapper = renderWorkers()
    wrapper.findComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'channels')
    await flushPromises()
    expect(mocks.channels).toHaveBeenCalledTimes(1)
    mocks.state.profileLoaded = false
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(0)
    old.resolve([{ id: 41, channelCode: 'old-channel' }])
    await flushPromises()
    mocks.state.workerMenu = false
    mocks.state.profileLoaded = true
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(0)
    expect(wrapper.text()).not.toContain('old-channel')
    mocks.state.workerMenu = true
    await flushPromises()
    wrapper.findComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'channels')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ProTable' }).props('data')).toEqual([])
  })

  it('文件中心有权访问时隐藏重复渠道入口；仅有 Worker 权限时保留只读渠道', async () => {
    const wrapper = renderWorkers()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(2)
    wrapper.findComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'channels')
    mocks.state.fileMenu = ['/files/templates']
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'ElTabs' }).props('modelValue')).toBe('workers')
    mocks.state.fileMenu = ['/files/channels']
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(1)
    mocks.state.fileMenu = []
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElTabPane' })).toHaveLength(2)
  })

  it('实际标签组件在菜单权限变化时切回 Worker 并保留查询回退', async () => {
    const wrapper = renderWorkers(true)
    await flushPromises()
    wrapper.findComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'channels')
    await flushPromises()
    expect(wrapper.get('#pane-channels').attributes('aria-hidden')).toBe('false')
    mocks.state.fileMenu = ['/files/templates']
    await flushPromises()
    expect(wrapper.find('#pane-channels').exists()).toBe(false)
    expect(wrapper.get('#pane-workers').attributes('aria-hidden')).toBe('false')
    mocks.state.fileMenu = []
    await flushPromises()
    expect(wrapper.find('#pane-channels').exists()).toBe(true)
  })
  it('未选择租户时提示先选择租户，不显示永久加载和实时连接状态', () => {
    mocks.state.tenantId = ''
    // TanStack Query 禁用时仍为 pending，不能当作请求正在进行。
    mocks.state.workerPending = true
    const wrapper = renderWorkers()

    expect(wrapper.find('.wk-grid').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OpsListToolbar' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'EmptyState' }).props('description')).toBe(
      'apiError.selectTenantFirst',
    )
  })

  it.each([
    ['zh-CN', '请选择顶部租户后查看数据'],
    ['en-US', 'Select a tenant at the top to view data'],
  ])('未选择租户时两个标签页均展示实际 %s 提示', (locale, expected) => {
    const i18n = createI18n({
      legacy: false,
      locale,
      fallbackLocale: false,
      messages: { 'zh-CN': zhCN, 'en-US': enUS },
      missingWarn: false,
    })
    mocks.translate.mockImplementation((key: string) => i18n.global.t(key))
    mocks.state.tenantId = ''
    mocks.state.workerPending = true
    const wrapper = renderWorkers()

    const descriptions = wrapper
      .findAllComponents({ name: 'EmptyState' })
      .map((item) => item.props('description'))
    expect(descriptions).toEqual([expected, expected])
  })

  it('选中租户后恢复加载反馈，请求失败时显示错误态', async () => {
    mocks.state.tenantId = ''
    mocks.state.workerPending = true
    mocks.state.workerRowsPresent = false
    mocks.state.workerDataAvailable = false
    const wrapper = renderWorkers()

    mocks.state.tenantId = 'tenant-a'
    await flushPromises()
    expect(wrapper.find('.wk-grid').exists()).toBe(true)
    expect(wrapper.find('.wk-grid').classes()).toContain('wk-grid--loading')
    expect(wrapper.findComponent({ name: 'OpsListToolbar' }).exists()).toBe(true)
    expect(wrapper.find('.wk-stats').exists()).toBe(false)

    mocks.state.workerPending = false
    mocks.state.workerError = new Error('请求失败')
    await flushPromises()
    expect(wrapper.find('.wk-grid').exists()).toBe(false)
    expect(wrapper.find('.wk-stats').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'EmptyState' }).props('title')).toBe(
      'workerManagement.loadFailed',
    )
  })

  it('切换租户时不展示旧租户数字，成功空列表才显示零', async () => {
    const wrapper = renderWorkers()
    expect(wrapper.findAll('.wk-stat__num').map((item) => item.text())).toEqual(['1', '0', '0'])

    mocks.state.tenantId = 'tenant-b'
    mocks.state.workerPending = true
    await flushPromises()
    expect(wrapper.find('.wk-stats').exists()).toBe(false)

    mocks.state.workerDataTenant = 'tenant-b'
    mocks.state.workerRowsPresent = false
    mocks.state.workerPending = false
    await flushPromises()
    expect(wrapper.findAll('.wk-stat__num').map((item) => item.text())).toEqual(['0', '0', '0'])
  })

  it('状态筛选优先使用已翻译的名称，未知状态使用元数据名称', () => {
    mocks.workerMeta = [
      { value: 'DECOMMISSIONED', label: '已下线' },
      { value: 'CUSTOM', label: '自定义状态' },
    ]
    const wrapper = renderWorkers()
    const segment = wrapper.findComponent({ name: 'StatusSegment' })
    expect(segment.props('items')).toEqual([
      expect.objectContaining({ value: '', label: 'common.all' }),
      expect.objectContaining({
        value: 'DECOMMISSIONED',
        label: 'enum.workerStatus.DECOMMISSIONED',
      }),
      expect.objectContaining({ value: 'CUSTOM', label: '自定义状态' }),
    ])
  })
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
