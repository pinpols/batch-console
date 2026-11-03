// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import DefinitionList from './JobDefinitionList.vue'
import DefinitionWizard from './JobDefinitionWizard.vue'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { advanceAuthSession, initializeSharedAuthRevision } from '@/api/authSession'
import {
  createConfigBatchRecovery,
  listConfigBatchRecoveries,
  saveConfigBatchRecovery,
} from '@/utils/configBatchRecovery'

// confirm 在非输入模式下运行时返回动作字符串；Element Plus 类型将其错误地与输入对象取交集。
const confirmed = 'confirm' as unknown as Awaited<ReturnType<typeof ElMessageBox.confirm>>

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
  getConfigBatchOperation: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  channels: vi.fn(),
  queues: vi.fn(),
  validate: vi.fn(),
  listRuns: vi.fn(),
  useRealTenant: false,
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: { kind?: string }) =>
      key === 'configBatchRecovery.record' ? `${key}:${params?.kind}` : key,
    te: () => false,
  }),
}))
vi.mock('@/stores/tenant', async (original) => {
  const actual = await original<typeof import('@/stores/tenant')>()
  return {
    useTenantStore: () =>
      mocks.useRealTenant
        ? actual.useTenantStore()
        : Object.assign(mocks.context, { registerTenantChangeGuard: () => () => {} }),
  }
})
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
vi.mock('@/composables/useDirtyForm', async (original) => {
  const actual = await original<typeof import('@/composables/useDirtyForm')>()
  return {
    useDirtyForm: (...args: Parameters<typeof actual.useDirtyForm>) =>
      mocks.useRealTenant
        ? actual.useDirtyForm(...args)
        : {
            markPristine: vi.fn(),
            confirmDiscard: vi.fn().mockResolvedValue(true),
            isDirty: ref(false),
          },
  }
})
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
vi.mock('@/api/instance', () => ({ instanceApi: { list: mocks.listRuns } }))
vi.mock('@/api/pipelineMeta', () => ({ fetchPipelineStages: vi.fn().mockResolvedValue({}) }))
vi.mock('@/api/configBatchRecovery', () => ({
  getConfigBatchOperation: mocks.getConfigBatchOperation,
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
  JobBundlePrefillDialog: false,
  JobBundleRecoveryPanel: false,
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
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
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
  if (change === 'tenant') {
    mocks.context.tenantId = 'tenant-b'
    localStorage.setItem(STORAGE_KEYS.tenantId, 'tenant-b')
  }
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
  setActivePinia(createPinia())
  mocks.useRealTenant = false
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.setItem(STORAGE_KEYS.tenantId, 'tenant-a')
  localStorage.removeItem(STORAGE_KEYS.authSessionRevision)
  initializeSharedAuthRevision()
  mocks.context = reactive({
    tenantId: 'tenant-a',
    actor: 'operator',
    writer: true,
    writesFrozen: false,
    tenantAdmin: false,
  })
  mocks.importBundle.mockReset().mockResolvedValue(success())
  mocks.createBundle.mockReset().mockResolvedValue(success())
  mocks.getConfigBatchOperation.mockReset()
  mocks.channels.mockReset().mockResolvedValue([])
  mocks.queues.mockReset().mockResolvedValue([])
  mocks.validate.mockReset().mockResolvedValue(true)
  mocks.refetch.mockReset().mockResolvedValue({})
  mocks.listRuns.mockReset().mockResolvedValue({ records: [] })
})

describe('作业定义查看入口统一到详情页', () => {
  it('列表“查看运行”跳到详情页的运行页签，不再在列表内打开查看抽屉', async () => {
    const wrapper = shallowMount(DefinitionList, { global: { stubs } })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      goDefinitionRuns: (row: { id: number; jobCode: string; tenantId: string }) => void
    }
    vm.goDefinitionRuns({ id: 7, jobCode: 'A', tenantId: 'tenant-a' })
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/jobs/definitions/7',
      query: { tenantId: 'tenant-a', tab: 'runs' },
    })
    expect(mocks.listRuns).not.toHaveBeenCalled()
  })
})

describe('作业向导的配置包预填', () => {
  it('关闭后保留输入，重新打开并应用后更新表单', async () => {
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    await click(wrapper, 'jobDefinitionWizard.importBundleJson')
    const payload = JSON.stringify({
      jobDefinitions: [{ jobCode: 'PREFILLED', jobName: 'Prefilled job' }],
    })
    wrapper.findComponent({ name: 'JsonTextareaInput' }).vm.$emit('update:modelValue', payload)
    await flushPromises()
    await click(wrapper, 'common.cancel')
    await click(wrapper, 'jobDefinitionWizard.importBundleJson')
    expect(wrapper.findComponent({ name: 'JsonTextareaInput' }).props('modelValue')).toBe(payload)
    await click(wrapper, 'jobDefinitionWizard.prefillConfirm')
    const model = wrapper.findComponent({ name: 'JobConfigBasicForm' }).props('model')
    expect(model.jobCode).toBe('PREFILLED')
    expect(model.jobName).toBe('Prefilled job')
    expect(wrapper.text()).not.toContain('jobDefinitionWizard.prefillConfirm')
  })
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

  it.each([
    { description: '网络中断', error: { code: 'ERR_NETWORK' } },
    { description: '服务端异常', error: { response: { status: 500 } } },
    { description: '幂等或状态冲突', error: { response: { status: 409 } } },
  ])('正式导入$description 后提示先核实目标，不能假定未执行', async ({ error }) => {
    mocks.importBundle.mockRejectedValueOnce(error)
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    expect(ElMessage.warning).toHaveBeenCalledWith('jobDefinitionList.bundleImportUnknownOutcome')
    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it('作业包参数被明确拒绝时不提示结果未知', async () => {
    mocks.importBundle.mockRejectedValueOnce({ response: { status: 400 } })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    expect(ElMessage.warning).not.toHaveBeenCalledWith(
      'jobDefinitionList.bundleImportUnknownOutcome',
    )
  })

  it('试运行中断不提示正式导入结果未知', async () => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    wrapper.findComponent({ name: 'ElCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await click(wrapper, 'jobDefinitionList.bundleImportValidate')
    expect(ElMessage.warning).not.toHaveBeenCalledWith(
      'jobDefinitionList.bundleImportUnknownOutcome',
    )
  })

  it('切换账号后旧导入失败不向新账号提示', async () => {
    const request = pending<ReturnType<typeof success>>()
    mocks.importBundle.mockReturnValueOnce(request.promise)
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    mocks.context.actor = 'another-operator'
    request.reject({ code: 'ERR_NETWORK' })
    await flushPromises()
    expect(ElMessage.warning).not.toHaveBeenCalledWith(
      'jobDefinitionList.bundleImportUnknownOutcome',
    )
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

  it.each([
    { description: '网络中断', error: { code: 'ERR_NETWORK' } },
    { description: '服务端异常', error: { response: { status: 500 } } },
    { description: '幂等或状态冲突', error: { response: { status: 409 } } },
  ])('向导提交$description 后提示先核实作业是否已创建', async ({ error }) => {
    mocks.createBundle.mockRejectedValueOnce(error)
    const { wrapper } = await renderWizard()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(ElMessage.warning).toHaveBeenCalledWith('jobDefinitionWizard.createBundleUnknownOutcome')
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('向导参数被明确拒绝时不提示结果未知', async () => {
    mocks.createBundle.mockRejectedValueOnce({ response: { status: 400 } })
    const { wrapper } = await renderWizard()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(ElMessage.warning).not.toHaveBeenCalledWith(
      'jobDefinitionWizard.createBundleUnknownOutcome',
    )
  })

  it('切换账号后旧向导提交失败不向新账号提示', async () => {
    const request = pending<ReturnType<typeof success>>()
    mocks.createBundle.mockReturnValueOnce(request.promise)
    const { wrapper } = await renderWizard()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    mocks.context.actor = 'another-operator'
    request.reject({ code: 'ERR_NETWORK' })
    await flushPromises()
    expect(ElMessage.warning).not.toHaveBeenCalledWith(
      'jobDefinitionWizard.createBundleUnknownOutcome',
    )
  })
})

describe('作业向导租户切换', () => {
  it('切换租户后旧创建请求的解析异常不提示到新租户', async () => {
    mocks.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const response = pending<ReturnType<typeof success>>()
    mocks.createBundle.mockReturnValueOnce(response.promise)
    const { wrapper } = await renderWizard()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(await tenant.requestTenantSwitch('tenant-b', async () => true)).toBe(true)
    response.reject(new SyntaxError('old response'))
    await flushPromises()
    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('空向导直接切换；取消后保留草稿，确认后清空所有旧租户字段', async () => {
    mocks.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    const form = wrapper.findComponent({ name: 'JobConfigBasicForm' }).props('model')
    form.jobCode = 'OLD_JOB'
    form.jobName = 'Old name'
    form.queueCode = 'OLD_QUEUE'
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(false)
    expect(form.jobCode).toBe('OLD_JOB')
    expect(form.queueCode).toBe('OLD_QUEUE')
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(true)
    await flushPromises()
    expect(form.jobCode).toBe('')
    expect(form.jobName).toBe('')
    expect(form.queueCode).toBe('')
    expect(wrapper.findComponent({ name: 'JobConfigBasicForm' }).props('tenantId')).toBe('tenant-c')
    expect(await tenant.requestTenantSwitch('tenant-d', confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('导入粘贴内容也是草稿，确认后不会传到新租户', async () => {
    mocks.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    const prefill = wrapper.findComponent({ name: 'JobBundlePrefillDialog' })
    prefill.vm.$emit('update:json', '{"jobDefinitions":[{"jobCode":"OLD"}]}')
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
    await flushPromises()
    expect(prefill.props('json')).toContain('OLD')
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    await flushPromises()
    expect(prefill.props('json')).toBe('')
    wrapper.unmount()
  })

  it('成功创建后不再提示放弃已保存内容', async () => {
    mocks.useRealTenant = true
    const { useTenantStore } =
      await vi.importActual<typeof import('@/stores/tenant')>('@/stores/tenant')
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const { wrapper } = await renderWizard()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    expect(mocks.createBundle).toHaveBeenCalledOnce()
    const confirm = vi.fn(async () => false)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('作业包原请求回查', () => {
  it.each(['import', 'create'])(
    '当前标签切换租户后，旧 %s 成功不清理记录或更新页面',
    async (kind) => {
      const response = pending<ReturnType<typeof success>>()
      const request = kind === 'import' ? mocks.importBundle : mocks.createBundle
      request.mockReturnValueOnce(response.promise)
      const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
      await click(
        wrapper,
        kind === 'import'
          ? 'jobDefinitionList.bundleImportConfirm'
          : 'jobDefinitionWizard.submitCreate',
      )
      const key = request.mock.calls[0]?.[1]

      mocks.context.tenantId = 'tenant-b'
      response.resolve(success())
      await flushPromises()

      expect(
        listConfigBatchRecoveries('operator', 'tenant-a').commands.map((item) => item.key),
      ).toContain(key)
      expect(ElMessage.success).not.toHaveBeenCalled()
      expect(mocks.refetch).not.toHaveBeenCalled()
      expect(mocks.push).not.toHaveBeenCalled()
      expect(request).toHaveBeenCalledTimes(1)
      if (kind === 'import')
        expect(wrapper.findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(true)
    },
  )

  it.each(['import', 'create'])('当前标签切换租户后，旧 %s 失败不向新上下文提示', async (kind) => {
    const response = pending<ReturnType<typeof success>>()
    const request = kind === 'import' ? mocks.importBundle : mocks.createBundle
    request.mockReturnValueOnce(response.promise)
    const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(
      wrapper,
      kind === 'import'
        ? 'jobDefinitionList.bundleImportConfirm'
        : 'jobDefinitionWizard.submitCreate',
    )

    mocks.context.tenantId = 'tenant-b'
    response.reject({ code: 'ERR_NETWORK' })
    await flushPromises()

    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each(['list', 'wizard'])('%s 回查期间当前标签切租户，不展示旧回执或旧错误', async (page) => {
    const command = createConfigBatchRecovery({
      actor: 'operator',
      headerTenant: 'tenant-a',
      auditTenantId: 'tenant-a',
      operationKind: 'JOB_BUNDLE_IMPORT',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    const wrapper =
      page === 'list'
        ? shallowMount(DefinitionList, { global: { stubs } })
        : shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    const response = pending<{
      operationId: string
      operationKind: string
      responseMetadata: object
      status: string
      targets: object[]
    }>()
    mocks.getConfigBatchOperation.mockReturnValueOnce(response.promise)
    await click(wrapper, 'configBatchRecovery.check')
    mocks.context.tenantId = 'tenant-b'
    response.resolve({
      operationId: 'old-operation',
      operationKind: 'JOB_BUNDLE_IMPORT',
      responseMetadata: {},
      status: 'COMPLETE',
      targets: [
        { ordinal: 0, tenantId: 'old-target', status: 'COMPLETE', result: { success: true } },
      ],
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('old-target')
    expect(wrapper.text()).not.toContain('configBatchRecovery.acknowledge')
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toContainEqual(command)
    expect(mocks.importBundle).not.toHaveBeenCalled()
    expect(mocks.createBundle).not.toHaveBeenCalled()
  })

  it.each(['list', 'wizard'])('%s 回查期间当前标签切租户，不展示旧 404', async (page) => {
    const command = createConfigBatchRecovery({
      actor: 'operator',
      headerTenant: 'tenant-a',
      auditTenantId: 'tenant-a',
      operationKind: 'JOB_BUNDLE_IMPORT',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    const wrapper =
      page === 'list'
        ? shallowMount(DefinitionList, { global: { stubs } })
        : shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    const response = pending<never>()
    mocks.getConfigBatchOperation.mockReturnValueOnce(response.promise)
    await click(wrapper, 'configBatchRecovery.check')
    mocks.context.tenantId = 'tenant-b'
    response.reject({ response: { status: 404 } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('configBatchRecovery.notFound')
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toContainEqual(command)
  })

  it.each(['import', 'create'])('%s 成功后本地记录清理失败仍报告成功并提示残留', async (kind) => {
    const response = pending<ReturnType<typeof success>>()
    const request = kind === 'import' ? mocks.importBundle : mocks.createBundle
    request.mockReturnValueOnce(response.promise)
    const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
    await click(
      wrapper,
      kind === 'import'
        ? 'jobDefinitionList.bundleImportConfirm'
        : 'jobDefinitionWizard.submitCreate',
    )
    const key = request.mock.calls[0]?.[1]
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    try {
      response.resolve(success())
      await flushPromises()
      expect(ElMessage.success).toHaveBeenCalledTimes(1)
      expect(ElMessage.warning).toHaveBeenCalledWith('configBatchRecovery.cleanupFailed')
      expect(
        listConfigBatchRecoveries('operator', 'tenant-a').commands.map((item) => item.key),
      ).toContain(key)
      expect(request).toHaveBeenCalledTimes(1)
    } finally {
      remove.mockRestore()
    }
  })

  it.each(['import', 'create'])('同标签会话代次变化后，旧 %s 成功不更新页面', async (kind) => {
    const response = pending<ReturnType<typeof success>>()
    const request = kind === 'import' ? mocks.importBundle : mocks.createBundle
    request.mockReturnValueOnce(response.promise)
    const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
    await click(
      wrapper,
      kind === 'import'
        ? 'jobDefinitionList.bundleImportConfirm'
        : 'jobDefinitionWizard.submitCreate',
    )
    advanceAuthSession()
    response.resolve(success())
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
  })

  it.each(['import', 'create'])('另一标签会话代次变化后，旧 %s 成功不更新页面', async (kind) => {
    const response = pending<ReturnType<typeof success>>()
    const request = kind === 'import' ? mocks.importBundle : mocks.createBundle
    request.mockReturnValueOnce(response.promise)
    const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
    await click(
      wrapper,
      kind === 'import'
        ? 'jobDefinitionList.bundleImportConfirm'
        : 'jobDefinitionWizard.submitCreate',
    )
    localStorage.setItem(STORAGE_KEYS.authSessionRevision, 'other-session')
    response.resolve(success())
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.refetch).not.toHaveBeenCalled()
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
  })

  it('导入响应丢失后刷新仍能只读核对，展示失败和未知目标且不重发', async () => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    let wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    const key = mocks.importBundle.mock.calls[0]?.[1]
    expect(key).toEqual(expect.any(String))
    wrapper.unmount()

    wrapper = shallowMount(DefinitionList, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('configBatchRecovery.kindJobBundleImport')
    expect(wrapper.text()).not.toContain('JOB_BUNDLE_IMPORT')
    mocks.getConfigBatchOperation.mockResolvedValue({
      operationId: 'operation-1',
      operationKind: 'JOB_BUNDLE_IMPORT',
      responseMetadata: {},
      status: 'UNKNOWN',
      targets: [
        {
          ordinal: 0,
          tenantId: 'tenant-a',
          status: 'COMPLETE',
          result: { tenantId: 'tenant-a', success: false },
        },
        { ordinal: 1, tenantId: 'tenant-b', status: 'UNKNOWN', result: null },
      ],
    })
    await click(wrapper, 'configBatchRecovery.check')
    expect(mocks.getConfigBatchOperation).toHaveBeenCalledWith(
      expect.objectContaining({ key, operationKind: 'JOB_BUNDLE_IMPORT' }),
      'operator',
      'tenant-a',
    )
    expect(wrapper.text()).toContain('configBatchRecovery.failed')
    expect(wrapper.text()).toContain('configBatchRecovery.unknown')
    expect(mocks.importBundle).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('configBatchRecovery.acknowledge')
  })

  it('向导响应丢失后可在列表查询原创建，回执齐全需用户确认后移除', async () => {
    mocks.createBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wizard = await renderWizard()
    wizard.wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wizard.wrapper, 'jobDefinitionWizard.submitCreate')
    const key = mocks.createBundle.mock.calls[0]?.[1]
    wizard.wrapper.unmount()
    const list = shallowMount(DefinitionList, { global: { stubs } })
    await flushPromises()
    expect(list.text()).toContain('configBatchRecovery.kindJobBundleCreate')
    expect(list.text()).not.toContain('JOB_BUNDLE_CREATE')
    mocks.getConfigBatchOperation.mockResolvedValue({
      operationId: 'operation-2',
      operationKind: 'JOB_BUNDLE_CREATE',
      responseMetadata: {},
      status: 'COMPLETE',
      targets: [
        {
          ordinal: 0,
          tenantId: 'tenant-a',
          status: 'COMPLETE',
          result: { tenantId: 'tenant-a', success: true },
        },
      ],
    })
    await click(list, 'configBatchRecovery.check')
    expect(mocks.getConfigBatchOperation).toHaveBeenCalledWith(
      expect.objectContaining({ key, operationKind: 'JOB_BUNDLE_CREATE' }),
      'operator',
      'tenant-a',
    )
    expect(list.text()).toContain('configBatchRecovery.success')
    await click(list, 'configBatchRecovery.acknowledge')
    expect(list.text()).not.toContain('configBatchRecovery.check')
    expect(mocks.createBundle).toHaveBeenCalledTimes(1)
  })

  it.each(['actor', 'tenant'])('切换 %s 后不展示原账号或租户的待查操作', async (change) => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    expect(wrapper.text()).toContain('configBatchRecovery.check')
    changeContext(change)
    await flushPromises()
    expect(wrapper.text()).not.toContain('configBatchRecovery.check')
    expect(mocks.getConfigBatchOperation).not.toHaveBeenCalled()
  })

  it('原请求查不到时保留记录且不发新的写请求', async () => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    mocks.getConfigBatchOperation.mockRejectedValueOnce({ response: { status: 404 } })
    await click(wrapper, 'configBatchRecovery.check')
    expect(wrapper.text()).toContain('configBatchRecovery.notFound')
    expect(wrapper.text()).toContain('configBatchRecovery.check')
    expect(mocks.importBundle).toHaveBeenCalledTimes(1)
  })

  it('原请求 404 后，只有明确确认才停止本地跟踪且不重发', async () => {
    mocks.importBundle.mockRejectedValueOnce({ response: { status: 400 } })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    expect(wrapper.text()).not.toContain('configBatchRecovery.stopTracking')
    mocks.getConfigBatchOperation.mockRejectedValue({ response: { status: 404 } })
    await click(wrapper, 'configBatchRecovery.check')
    const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
    try {
      await click(wrapper, 'configBatchRecovery.stopTracking')
      expect(wrapper.text()).toContain('configBatchRecovery.check')
      expect(confirmation).toHaveBeenCalledWith(
        'configBatchRecovery.stopTrackingMessage',
        'configBatchRecovery.stopTrackingTitle',
        expect.objectContaining({ type: 'warning' }),
      )
      confirmation.mockResolvedValueOnce(confirmed)
      await click(wrapper, 'configBatchRecovery.stopTracking')
      expect(wrapper.text()).not.toContain('configBatchRecovery.check')
      expect(mocks.importBundle).toHaveBeenCalledTimes(1)
      expect(mocks.getConfigBatchOperation).toHaveBeenCalledTimes(1)
    } finally {
      confirmation.mockRestore()
    }
  })

  it('向导的 UNKNOWN 回执可经确认停止跟踪，不会重发创建', async () => {
    mocks.createBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const { wrapper } = await renderWizard()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionWizard.submitCreate')
    mocks.getConfigBatchOperation.mockResolvedValue({
      operationId: 'operation-unknown',
      operationKind: 'JOB_BUNDLE_CREATE',
      responseMetadata: {},
      status: 'UNKNOWN',
      targets: [{ ordinal: 0, tenantId: 'tenant-a', status: 'UNKNOWN', result: null }],
    })
    await click(wrapper, 'configBatchRecovery.check')
    const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce(confirmed)
    try {
      await click(wrapper, 'configBatchRecovery.stopTracking')
      expect(wrapper.text()).not.toContain('configBatchRecovery.check')
      expect(mocks.createBundle).toHaveBeenCalledTimes(1)
    } finally {
      confirmation.mockRestore()
    }
  })

  it('停止跟踪的确认等待期间切换账号，不会清理原账号记录', async () => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    mocks.getConfigBatchOperation.mockRejectedValue({ response: { status: 404 } })
    await click(wrapper, 'configBatchRecovery.check')
    const reply = pending<Awaited<ReturnType<typeof ElMessageBox.confirm>>>()
    const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockReturnValueOnce(reply.promise)
    try {
      await click(wrapper, 'configBatchRecovery.stopTracking')
      changeContext('actor')
      await flushPromises()
      reply.resolve(confirmed)
      await flushPromises()
      mocks.context.actor = 'operator'
      await flushPromises()
      expect(wrapper.text()).toContain('configBatchRecovery.check')
      expect(mocks.importBundle).toHaveBeenCalledTimes(1)
    } finally {
      confirmation.mockRestore()
    }
  })

  it('同一身份可以分别查看多条待查操作', async () => {
    mocks.importBundle.mockRejectedValue({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    const checks = wrapper
      .findAll('button')
      .filter((button) => button.text() === 'configBatchRecovery.check')
    expect(checks).toHaveLength(2)
    mocks.getConfigBatchOperation.mockRejectedValue({ response: { status: 404 } })
    await checks[1]!.trigger('click')
    await flushPromises()
    expect(mocks.getConfigBatchOperation).toHaveBeenCalledWith(
      expect.objectContaining({ key: mocks.importBundle.mock.calls[1]?.[1] }),
      'operator',
      'tenant-a',
    )
    expect(mocks.importBundle).toHaveBeenCalledTimes(2)
  })

  it('回查在途时切换账号，旧结果不能显示给新账号', async () => {
    mocks.importBundle.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await renderList()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'jobDefinitionList.bundleImportConfirm')
    const response = pending<{
      operationId: string
      operationKind: string
      responseMetadata: object
      status: string
      targets: object[]
    }>()
    mocks.getConfigBatchOperation.mockReturnValueOnce(response.promise)
    await click(wrapper, 'configBatchRecovery.check')
    changeContext('actor')
    response.resolve({
      operationId: 'operation-old',
      operationKind: 'JOB_BUNDLE_IMPORT',
      responseMetadata: {},
      status: 'COMPLETE',
      targets: [
        { ordinal: 0, tenantId: 'old-tenant', status: 'COMPLETE', result: { success: true } },
      ],
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('old-tenant')
    expect(wrapper.text()).not.toContain('configBatchRecovery.acknowledge')
  })

  it.each(['import', 'create'])('无法保存原键时不发送正式 %s 请求', async (kind) => {
    const wrapper = kind === 'import' ? await renderList() : (await renderWizard()).wrapper
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    try {
      await click(
        wrapper,
        kind === 'import'
          ? 'jobDefinitionList.bundleImportConfirm'
          : 'jobDefinitionWizard.submitCreate',
      )
      expect(ElMessage.error).toHaveBeenCalledWith('configBatchRecovery.storageUnavailable')
      expect(mocks.importBundle).not.toHaveBeenCalled()
      expect(mocks.createBundle).not.toHaveBeenCalled()
    } finally {
      storage.mockRestore()
    }
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
    for (let i = 0; i < 4; i++) await click(wrapper, 'jobDefinitionWizard.nextStep')
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
    for (let i = 0; i < 4; i++) await click(wrapper, 'jobDefinitionWizard.nextStep')
    expect(wrapper.findAllComponents({ name: 'ElSelect' })[0]!.props('modelValue')).toEqual([])
    expect(wrapper.text()).not.toContain('CHANNEL_A')
    nextChannels.resolve([])
    await flushPromises()
  })
})

describe('作业向导步骤校验边界', () => {
  it('限制上游作业引用为 64 字符，同时保留作业编码 128 字符', async () => {
    const wrapper = shallowMount(DefinitionWizard, { global: { stubs } })
    await flushPromises()
    const formRules = (
      wrapper.vm as unknown as {
        rules: Record<
          string,
          Array<{
            validator?: (rule: object, value: string, done: (error?: Error) => void) => void
          }>
        >
      }
    ).rules
    const dependencyValidator = formRules.dependsOnJobCode.find(
      (rule) => rule.validator,
    )!.validator!
    const codeValidator = formRules.jobCode.find((rule) => rule.validator)!.validator!
    const done = vi.fn()
    dependencyValidator({}, 'a'.repeat(64), done)
    expect(done).toHaveBeenLastCalledWith()
    dependencyValidator({}, 'a'.repeat(65), done)
    expect(done).toHaveBeenLastCalledWith(expect.any(Error))
    codeValidator({}, 'a'.repeat(128), done)
    expect(done).toHaveBeenLastCalledWith()
    wrapper.unmount()
  })
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
