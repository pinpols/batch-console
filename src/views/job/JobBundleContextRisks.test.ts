// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import DefinitionList from './JobDefinitionList.vue'
import DefinitionWizard from './JobDefinitionWizard.vue'

const mocks = vi.hoisted(() => ({
  context: null as unknown as {
    tenantId: string
    actor: string
    writer: boolean
    writesFrozen: boolean
    tenantAdmin: boolean
  },
  exportBundle: vi.fn(),
  importBundle: vi.fn(),
  createBundle: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  channels: vi.fn(),
  queues: vi.fn(),
  validate: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.context }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.context }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get userInfo() {
      return { username: mocks.context.actor }
    },
  }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => mocks.context.writer),
    canWriteSystem: computed(() => mocks.context.writer && !mocks.context.writesFrozen),
    canMutateConfig: computed(
      () => (mocks.context.writer || mocks.context.tenantAdmin) && !mocks.context.writesFrozen,
    ),
  }),
}))
vi.mock('@/composables/useDirtyForm', () => ({
  useDirtyForm: () => ({
    markPristine: vi.fn(),
    confirmDiscard: vi.fn().mockResolvedValue(true),
    isDirty: ref(false),
  }),
}))
vi.mock('@/composables/useDrawerAutoClose', () => ({ useDrawerAutoClose: vi.fn() }))
vi.mock('@/composables/queries/useJobDefinitionsPaged', () => ({
  useJobDefinitionsPaged: () => ({
    data: ref({ records: [], total: 0 }),
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
    refetch: mocks.refetch,
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/api/job', () => ({
  jobApi: {
    exportBundle: mocks.exportBundle,
    importBundle: mocks.importBundle,
    createBundle: mocks.createBundle,
  },
}))
vi.mock('@/api/meta', () => ({
  getMetaEnums: vi.fn().mockResolvedValue({}),
  getMetaQueues: mocks.queues,
}))
vi.mock('@/api/fileChannelsQuery', () => ({ queryFileChannels: mocks.channels }))
vi.mock('@/api/system', () => ({ queryFileTemplates: vi.fn().mockResolvedValue({ items: [] }) }))
vi.mock('@/api/workflow', () => ({
  workflowApi: { listDefinitions: vi.fn().mockResolvedValue({ records: [] }) },
}))
vi.mock('@/api/governance', () => ({
  governanceApi: { listAlertRoutings: vi.fn().mockResolvedValue([]) },
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
enableAutoUnmount(afterEach)
const pass = {
  template: '<section><slot /><slot name="actions" /><slot name="footer" /></section>',
}
const stubs = {
  PageContainer: pass,
  PageHeader: pass,
  SectionCard: pass,
  ElTooltip: pass,
  ElDialog: {
    name: 'ElDialog',
    props: ['modelValue'],
    template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
  },
  ElForm: defineComponent({
    name: 'ElForm',
    props: ['model'],
    setup(_, { slots, expose }) {
      expose({ validate: mocks.validate })
      return () => h('form', slots.default?.())
    },
  }),
  ElFormItem: pass,
  ElCollapse: pass,
  ElCollapseItem: pass,
  ElButton: {
    props: ['loading', 'disabled'],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElOption: { name: 'ElOption', props: ['value', 'label'], template: '<span>{{ label }}</span>' },
  ElRadioGroup: {
    name: 'ElRadioGroup',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElCheckbox: {
    name: 'ElCheckbox',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<span><slot /></span>',
  },
  ListPageQueryBar: pass,
  ProTable: true,
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function success() {
  return {
    result: {
      totalTenants: 1,
      successTenants: 1,
      failureTenants: 0,
      results: [{ tenantId: 'tenant-a', success: true }],
    },
  }
}
type Wrapper = ReturnType<typeof shallowMount>
async function click(wrapper: Wrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  expect(button, label).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
async function renderList() {
  const wrapper = shallowMount(DefinitionList, { global: { stubs } })
  await flushPromises()
  await click(wrapper, 'jobDefinitionList.headerBundle')
  wrapper.findComponent({ name: 'JsonTextareaInput' }).vm.$emit('update:modelValue', '{}')
  await flushPromises()
  return wrapper
}
async function renderWizard() {
  const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
  await flushPromises()
  const model = wrapper.findComponent({ name: 'JobConfigBasicForm' }).props('model')
  model.jobCode = 'JOB_A'
  model.jobName = 'Job A'
  for (let i = 0; i < 5; i++) await click(wrapper, 'jobDefinitionWizard.nextStep')
  return { wrapper, model }
}
function changeContext(change: string) {
  if (change === 'tenant') mocks.context.tenantId = 'tenant-b'
  if (change === 'actor') mocks.context.actor = 'another-operator'
  if (change === 'permission') {
    mocks.context.writer = false
    mocks.context.writer = true
  }
  if (change === 'maintenance') {
    mocks.context.writesFrozen = true
    mocks.context.writesFrozen = false
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.context = reactive({
    tenantId: 'tenant-a',
    actor: 'operator',
    writer: true,
    writesFrozen: false,
    tenantAdmin: false,
  })
  mocks.importBundle.mockReset().mockResolvedValue(success())
  mocks.createBundle.mockReset().mockResolvedValue(success())
  mocks.channels.mockReset().mockResolvedValue([])
  mocks.queues.mockReset().mockResolvedValue([])
  mocks.validate.mockReset().mockResolvedValue(true)
  mocks.refetch.mockReset().mockResolvedValue({})
})
describe('作业包导入的响应归属', () => {
  it.each(['tenant', 'actor', 'permission', 'maintenance', 'input', 'reopen', 'unmount'])(
    '%s 后的旧成功不提示、不关闭新面板、不刷新新上下文',
    async (change) => {
      const reply = pending<ReturnType<typeof success>>()
      mocks.importBundle.mockReturnValueOnce(reply.promise)
      const wrapper = await renderList()
      await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
      if (change === 'input')
        wrapper
          .findComponent({ name: 'JsonTextareaInput' })
          .vm.$emit('update:modelValue', '{"resourceQueues":[]}')
      if (change === 'reopen') {
        await click(wrapper, 'common.cancel')
        await click(wrapper, 'jobDefinitionList.headerBundle')
      }
      if (change === 'unmount') wrapper.unmount()
      changeContext(change)
      await flushPromises()
      reply.resolve(success())
      await flushPromises()
      expect(ElMessage.success).not.toHaveBeenCalled()
      expect(mocks.refetch).not.toHaveBeenCalled()
      if (change === 'reopen')
        expect(wrapper.findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(true)
    },
  )
  it('试运行状态保持时显示试运行结果', async () => {
    const wrapper = await renderList()
    wrapper.findComponent({ name: 'ElCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await click(wrapper, 'jobDefinitionList.bundleImportValidate')
    expect(mocks.importBundle).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, targetTenantIds: ['tenant-a'] }),
    )
    expect(ElMessage.success).toHaveBeenCalledWith('jobDefinitionList.bundleImportDryRunDone')
  })
})
describe('作业向导提交的响应归属', () => {
  it.each(['tenant', 'actor', 'permission', 'maintenance', 'input', 'unmount'])(
    '%s 后的旧成功不导航或提示',
    async (change) => {
      const reply = pending<ReturnType<typeof success>>()
      mocks.createBundle.mockReturnValueOnce(reply.promise)
      const { wrapper, model } = await renderWizard()
      await click(wrapper, 'jobDefinitionWizard.submitCreate')
      if (change === 'input') model.jobCode = 'JOB_B'
      if (change === 'unmount') wrapper.unmount()
      changeContext(change)
      await flushPromises()
      reply.resolve(success())
      await flushPromises()
      expect(mocks.push).not.toHaveBeenCalled()
      expect(ElMessage.success).not.toHaveBeenCalled()
    },
  )
  it('同一提交未结束时重复点击只发一条请求', async () => {
    const reply = pending<ReturnType<typeof success>>()
    mocks.createBundle.mockReturnValue(reply.promise)
    const { wrapper } = await renderWizard()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(mocks.createBundle).toHaveBeenCalledTimes(1)
    reply.resolve(success())
    await flushPromises()
  })
  it('当前有效成功按已提交编码导航', async () => {
    const { wrapper } = await renderWizard()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/jobs/definitions',
      query: { jobCode: 'JOB_A' },
    })
    expect(ElMessage.success).toHaveBeenCalledTimes(1)
  })
})

describe('作业向导关联选项的租户边界', () => {
  it('旧租户渠道迟到后不能覆盖新租户的关联列表', async () => {
    const oldChannels = pending<Array<{ id: number; channelCode: string; channelName: string }>>()
    mocks.channels.mockImplementation((tenantId: string) =>
      tenantId === 'tenant-a'
        ? oldChannels.promise
        : Promise.resolve([{ id: 22, channelCode: 'CHANNEL_B', channelName: 'current-channel' }]),
    )
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    for (let i = 0; i < 4; i++) await click(wrapper, 'jobDefinitionWizard.nextStep')
    mocks.context.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).toContain('CHANNEL_B')
    oldChannels.resolve([{ id: 11, channelCode: 'CHANNEL_A', channelName: 'stale-channel' }])
    await flushPromises()
    expect(wrapper.text()).toContain('CHANNEL_B')
    expect(wrapper.text()).not.toContain('CHANNEL_A')
  })
  it('旧租户元数据迟到后不能覆盖当前队列或续发关联请求', async () => {
    const oldQueues = pending<Array<{ value: string; label: string }>>()
    mocks.queues.mockImplementation((tenantId: string) =>
      tenantId === 'tenant-a'
        ? oldQueues.promise
        : Promise.resolve([{ value: 'QUEUE_B', label: 'current-queue' }]),
    )
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    mocks.context.tenantId = 'tenant-b'
    await flushPromises()
    oldQueues.resolve([{ value: 'QUEUE_A', label: 'stale-queue' }])
    await flushPromises()
    expect(wrapper.findComponent({ name: 'JobConfigBasicForm' }).props('queueOptions')).toEqual([
      { value: 'QUEUE_B', label: 'current-queue' },
    ])
    expect(mocks.channels.mock.calls.map(([tenantId]) => tenantId)).toEqual(['tenant-b'])
  })
  it('切换租户立即清空旧关联选择和选项，不等待新租户读取完成', async () => {
    const nextChannels = pending<never[]>()
    mocks.channels.mockImplementation((tenantId: string) =>
      tenantId === 'tenant-b'
        ? nextChannels.promise
        : Promise.resolve([{ id: 11, channelCode: 'CHANNEL_A', channelName: 'old-channel' }]),
    )
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    for (let i = 0; i < 4; i++) await click(wrapper, 'jobDefinitionWizard.nextStep')
    wrapper.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', [11])
    await flushPromises()
    mocks.context.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElSelect' })[0]!.props('modelValue')).toEqual([])
    expect(wrapper.text()).not.toContain('CHANNEL_A')
    nextChannels.resolve([])
    await flushPromises()
  })
})

describe('作业向导步骤校验边界', () => {
  it('同一次异步校验期间重复点击不能跳过步骤', async () => {
    const validation = pending<boolean>()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    await click(wrapper, 'jobDefinitionWizard.nextStep')
    await click(wrapper, 'jobDefinitionWizard.nextStep')
    validation.resolve(true)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElSteps' }).attributes('active')).toBe('1')
    expect(mocks.validate).toHaveBeenCalledTimes(1)
  })
  it.each(['tenant', 'actor'])('步骤校验期间切换 %s 不继续推进旧校验', async (change) => {
    const validation = pending<boolean>()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    await click(wrapper, 'jobDefinitionWizard.nextStep')
    changeContext(change)
    await flushPromises()
    validation.resolve(true)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElSteps' }).attributes('active')).toBe('0')
  })
})

describe('作业包与普通作业创建的权限边界', () => {
  it('租户管理员保留普通新建，打包向导和导入入口禁用', async () => {
    mocks.context.writer = false
    mocks.context.tenantAdmin = true
    const wrapper = shallowMount(DefinitionList, { global: { stubs } })
    await flushPromises()
    const action = (label: string) =>
      wrapper.findAll('button').find((button) => button.text() === label)!
    expect(action('jobDefinitionList.headerQuickCreate').attributes('disabled')).toBeUndefined()
    expect(action('jobDefinitionList.headerNew').attributes('disabled')).toBeDefined()
    expect(action('jobDefinitionList.headerBundle').attributes('disabled')).toBeDefined()
  })
})

describe('作业包导出的管理员边界', () => {
  it('只读用户禁用导出入口，直接调用动作也不发送管理员请求', async () => {
    mocks.context.writer = false
    const wrapper = shallowMount(DefinitionList, {
      global: {
        stubs: {
          ...stubs,
          ProTable: defineComponent({
            setup(_, { slots }) {
              return () => h('div', slots.default?.({ isColVisible: () => false }))
            },
          }),
          ElTableColumn: defineComponent({
            setup(_, { slots }) {
              return () =>
                h(
                  'div',
                  slots.default?.({ row: { id: 1, jobCode: 'JOB_A', tenantId: 'tenant-a' } }),
                )
            },
          }),
        },
      },
    })
    await flushPromises()
    const actions = wrapper.findComponent({ name: 'RowActions' }).props('actions') as Array<{
      key: string
      disabled?: boolean
      onClick: () => Promise<void>
    }>
    const exportAction = actions.find((action) => action.key === 'export-bundle')!
    expect(exportAction.disabled).toBe(true)
    await exportAction.onClick()
    expect(mocks.exportBundle).not.toHaveBeenCalled()
  })
})
