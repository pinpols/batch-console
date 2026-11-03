// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import JobDefinitionDetail from './JobDefinitionDetail.vue'

const mocks = vi.hoisted(() => ({
  tenant: { tenantId: 'tenant-a' },
  route: { params: { id: '7' }, query: { tenantId: 'tenant-a' } },
  push: vi.fn(),
  replace: vi.fn(),
  getDefinition: vi.fn(),
  list: vi.fn(),
  trigger: vi.fn(),
  prompt: vi.fn(),
  warning: vi.fn(),
  permission: { value: true },
  admin: { value: true },
  menuPaths: [] as string[],
  workflows: vi.fn(),
  alerts: vi.fn(),
  audits: vi.fn(),
  success: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, args?: unknown) => `${key}${args ? JSON.stringify(args) : ''}`,
  }),
}))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({
    hasBackendMenuAccess: (path: string) => mocks.menuPaths.includes(path),
  }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canMutateConfig: computed(() => mocks.permission.value),
    canWriteSystem: computed(() => mocks.admin.value),
    canManageSystem: computed(() => mocks.admin.value),
  }),
}))
vi.mock('@/composables/useResponsive', () => ({ useResponsive: () => ({ isMobile: ref(false) }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (fn: () => void) => fn() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/api/job', () => ({
  jobApi: { getDefinition: mocks.getDefinition, trigger: mocks.trigger },
}))
vi.mock('@/api/instance', () => ({ instanceApi: { list: mocks.list } }))
vi.mock('@/api/workflow', () => ({ workflowApi: { listDefinitions: mocks.workflows } }))
vi.mock('@/api/governance', () => ({ governanceApi: { listAlertRoutings: mocks.alerts } }))
vi.mock('@/api/observabilityQueries', () => ({ queryAuditsPage: mocks.audits }))
vi.mock('@/api/authSession', () => ({
  currentAuthSession: () => 1,
  isSharedAuthRevisionCurrent: () => true,
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { warning: mocks.warning, success: mocks.success },
  ElMessageBox: { prompt: mocks.prompt },
}))

enableAutoUnmount(afterEach)
function render() {
  return shallowMount(JobDefinitionDetail, {
    global: {
      stubs: {
        PageContainer: { template: '<main><slot /></main>' },
        PageHeader: { template: '<header><slot name="actions" /></header>' },
        SectionCard: { template: '<section><slot /></section>' },
        ElButton: { template: '<button><slot /></button>' },
        ElAlert: { template: '<div><slot name="title" /><slot /></div>' },
        ElTabs: { name: 'ElTabs', template: '<div><slot /></div>' },
        ElTabPane: { template: '<div><slot /></div>' },
        ElTable: { name: 'ElTable', props: ['data'], template: '<div><slot /></div>' },
      },
    },
  })
}
function button(wrapper: ReturnType<typeof render>, text: string) {
  return wrapper.findAll('button').find((item) => item.text() === text)!
}
describe('作业详情上下文', () => {
  beforeEach(() => {
    mocks.tenant = reactive({ tenantId: 'tenant-a' })
    mocks.route = reactive({ params: { id: '7' }, query: { tenantId: 'tenant-a' } })
    mocks.permission.value = true
    mocks.admin.value = true
    mocks.menuPaths = [
      '/governance/calendars',
      '/governance/windows',
      '/governance/queues',
      '/governance/quota',
    ]
    mocks.push.mockReset()
    mocks.replace.mockReset()
    mocks.trigger.mockReset()
    mocks.prompt.mockReset()
    mocks.warning.mockReset()
    mocks.success.mockReset()
    mocks.workflows.mockReset().mockResolvedValue({ records: [] })
    mocks.alerts.mockReset().mockResolvedValue([])
    mocks.audits.mockReset().mockResolvedValue({ items: [] })
    mocks.getDefinition.mockReset().mockResolvedValue({
      id: 7,
      tenantId: 'tenant-a',
      jobCode: 'JOB_A',
      jobType: 'GENERAL',
      defaultWorkflowDefinitionId: 10,
    })
    mocks.list.mockReset().mockResolvedValue({ records: [], total: 0 })
  })
  it('租户管理员仅看到有权限的治理入口', async () => {
    mocks.admin.value = false
    const wrapper = render()
    await flushPromises()
    expect(button(wrapper, 'jobDefinitionDetail.maintainCalendar')).toBeDefined()
    for (const key of ['btnNewCalendar', 'btnNewWindow', 'maintainWindow', 'maintainQueue']) {
      expect(button(wrapper, `jobDefinitionDetail.${key}`)).toBeUndefined()
    }
    expect(button(wrapper, 'jobDefinitionDetail.maintainQuota')).toBeDefined()
  })

  it('后端菜单未授权时不显示目标入口', async () => {
    mocks.menuPaths = []
    const wrapper = render()
    await flushPromises()
    for (const key of ['maintainCalendar', 'maintainWindow', 'maintainQueue', 'maintainQuota']) {
      expect(button(wrapper, `jobDefinitionDetail.${key}`)).toBeUndefined()
    }
  })

  it('平台管理员可以使用治理快捷入口', async () => {
    const wrapper = render()
    await flushPromises()
    for (const key of [
      'btnNewCalendar',
      'btnNewWindow',
      'maintainCalendar',
      'maintainWindow',
      'maintainQueue',
    ]) {
      expect(button(wrapper, `jobDefinitionDetail.${key}`)).toBeDefined()
    }
  })

  it('同租户查看全部使用精确作业编码', async () => {
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'runs')
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', exactJobCode: 'JOB_A', pageSize: 15 }),
    )
    await button(wrapper, 'jobDefinitionDetail.viewAll').trigger('click')
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/monitor/job-instances',
      query: { exactJobCode: 'JOB_A', range: 'all' },
    })
  })
  it('当前租户不一致时禁止编辑和查看运行详情', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(button(wrapper, 'common.edit')).toBeUndefined()
    await button(wrapper, 'jobDefinitionDetail.viewAll').trigger('click')
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('tenant-a'))
  })
  it('触发确认期间租户切换再切回，旧确认不能提交', async () => {
    let resolve!: (value: { value: string }) => void
    mocks.prompt.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = render()
    await flushPromises()
    await button(wrapper, 'jobDefinitionDetail.manualTrigger').trigger('click')
    mocks.tenant.tenantId = 'tenant-b'
    mocks.tenant.tenantId = 'tenant-a'
    resolve({ value: '{}' })
    await flushPromises()
    expect(mocks.trigger).not.toHaveBeenCalled()
  })
  it('触发已发出后切换租户，旧响应不在新上下文提示成功', async () => {
    let finish!: () => void
    mocks.prompt.mockResolvedValue({ value: '{}' })
    mocks.trigger.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await button(wrapper, 'jobDefinitionDetail.manualTrigger').trigger('click')
    await flushPromises()
    expect(mocks.trigger).toHaveBeenCalledOnce()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finish()
    await flushPromises()
    expect(mocks.success).not.toHaveBeenCalled()
  })
  it('刷新详情失败时保留正在加载的运行记录并提供重试', async () => {
    let finishRuns!: (value: unknown) => void
    let failRefresh!: (reason: Error) => void
    mocks.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRuns = resolve
      }),
    )
    mocks.getDefinition
      .mockResolvedValueOnce({ id: 7, tenantId: 'tenant-a', jobCode: 'JOB_A', jobType: 'GENERAL' })
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          failRefresh = reject
        }),
      )
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'runs')
    await flushPromises()
    await button(wrapper, 'common.refresh').trigger('click')
    failRefresh(new Error('network'))
    await flushPromises()
    expect(wrapper.text()).toContain('jobDefinitionDetail.loadFailed')
    finishRuns({ records: [{ id: 71, instanceNo: 'A-1' }] })
    await flushPromises()
    const table = wrapper
      .findAllComponents({ name: 'ElTable' })
      .find((item) => (item.props('data') as Array<unknown>)?.length)
    expect(table?.props('data')).toEqual([{ id: 71, instanceNo: 'A-1' }])
    expect(button(wrapper, 'common.retry')).toBeDefined()
    await button(wrapper, 'common.retry').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('jobDefinitionDetail.loadFailed')
  })
  it('已有运行记录在详情刷新失败和再次加载期间保持可见', async () => {
    let failRefresh!: (reason: Error) => void
    let finishRuns!: (value: unknown) => void
    mocks.list
      .mockResolvedValueOnce({ records: [{ id: 71, instanceNo: 'A-1' }] })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRuns = resolve
        }),
      )
    mocks.getDefinition
      .mockResolvedValueOnce({ id: 7, tenantId: 'tenant-a', jobCode: 'JOB_A', jobType: 'GENERAL' })
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          failRefresh = reject
        }),
      )
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'runs')
    await flushPromises()
    const records = () =>
      wrapper
        .findAllComponents({ name: 'ElTable' })
        .some(
          (item) =>
            JSON.stringify(item.props('data')) === JSON.stringify([{ id: 71, instanceNo: 'A-1' }]),
        )
    await button(wrapper, 'common.refresh').trigger('click')
    expect(records()).toBe(true)
    failRefresh(new Error('network'))
    await flushPromises()
    expect(records()).toBe(true)
    await button(wrapper, 'common.retry').trigger('click')
    await flushPromises()
    expect(records()).toBe(true)
    finishRuns({ records: [{ id: 72, instanceNo: 'A-2' }] })
    await flushPromises()
    expect(records()).toBe(false)
  })
  it('首次加载失败显示重试而不是作业不存在', async () => {
    mocks.getDefinition.mockRejectedValueOnce(new Error('network'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('jobDefinitionDetail.loadFailed')
    expect(wrapper.text()).not.toContain('jobDefinitionDetail.emptyJob')
    expect(button(wrapper, 'common.retry')).toBeDefined()
  })
  it('旧作业详情晚到时不能覆盖当前作业', async () => {
    let finishOld!: (value: unknown) => void
    mocks.getDefinition.mockImplementation((id: number) =>
      id === 7
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ id: 8, tenantId: 'tenant-a', jobCode: 'JOB_B', jobType: 'GENERAL' }),
    )
    const wrapper = render()
    mocks.route.params.id = '8'
    await flushPromises()
    finishOld({ id: 7, tenantId: 'tenant-a', jobCode: 'JOB_A', jobType: 'GENERAL' })
    await flushPromises()
    expect(wrapper.text()).toContain('JOB_B')
    expect(wrapper.text()).not.toContain('JOB_A')
  })
  it('旧作业运行列表晚到时不能覆盖当前作业的运行记录', async () => {
    let finishOld!: (value: unknown) => void
    mocks.getDefinition.mockImplementation((id: number) =>
      Promise.resolve({
        id,
        tenantId: 'tenant-a',
        jobCode: id === 7 ? 'JOB_A' : 'JOB_B',
        jobType: 'GENERAL',
      }),
    )
    mocks.list.mockImplementation((query: { exactJobCode: string }) =>
      query.exactJobCode === 'JOB_A'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve({ records: [{ id: 82, instanceNo: 'B-1' }], total: 1 }),
    )
    const wrapper = render()
    await flushPromises()
    wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'runs')
    await flushPromises()
    mocks.route.params.id = '8'
    await flushPromises()
    finishOld({ records: [{ id: 71, instanceNo: 'A-1' }], total: 1 })
    await flushPromises()
    const tables = wrapper.findAllComponents({ name: 'ElTable' })
    const runTable = tables.find((table) => (table.props('data') as Array<unknown>)?.length)
    expect(runTable?.props('data')).toEqual([{ id: 82, instanceNo: 'B-1' }])
  })
  it.each(['workflow', 'alerts', 'audit'] as const)(
    '%s 页签的旧请求晚到时不能覆盖新作业',
    async (tab) => {
      let finishOld!: (value: unknown) => void
      mocks.getDefinition.mockImplementation((id: number) =>
        Promise.resolve({
          id,
          tenantId: 'tenant-a',
          jobCode: id === 7 ? 'JOB_A' : 'JOB_B',
          jobType: 'GENERAL',
        }),
      )
      const fetch =
        tab === 'workflow' ? mocks.workflows : tab === 'alerts' ? mocks.alerts : mocks.audits
      const row = tab === 'audit' ? { id: 82, detailSummary: 'JOB_B' } : { id: 82 }
      const result = (data: unknown[]) =>
        tab === 'workflow' ? { records: data } : tab === 'audit' ? { items: data } : data
      fetch
        .mockReset()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishOld = resolve
            }),
        )
        .mockResolvedValue(result([row]))
      const wrapper = render()
      await flushPromises()
      wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', tab)
      await flushPromises()
      mocks.route.params.id = '8'
      await flushPromises()
      finishOld(result([{ id: 71, detailSummary: 'JOB_A' }]))
      await flushPromises()
      const tables = wrapper.findAllComponents({ name: 'ElTable' })
      const table = tables.find((item) => (item.props('data') as Array<unknown>)?.length)
      expect(table?.props('data')).toEqual([row])
    },
  )
})
