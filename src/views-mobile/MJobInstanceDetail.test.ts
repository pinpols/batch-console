// @vitest-environment jsdom
import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MJobInstanceDetail from './MJobInstanceDetail.vue'
import { instanceApi } from '@/api/instance'
import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
import { getTaskHeartbeatDetails } from '@/api/taskHeartbeat'

const state = vi.hoisted(() => ({
  permission: null as unknown as { allowed: boolean },
  tenant: null as unknown as { tenantId: string },
  route: null as unknown as { params: { id: string }; query: Record<string, unknown> },
}))
vi.mock('@/composables/usePermission', async () => {
  const { computed } = await import('vue')
  return { usePermission: () => ({ canWriteSystem: computed(() => state.permission.allowed) }) }
})
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/api/instance', () => ({
  instanceApi: { detail: vi.fn(), partitions: vi.fn(), retry: vi.fn(), terminate: vi.fn() },
}))
vi.mock('@/api/taskHeartbeat', () => ({
  getTaskHeartbeatDetails: vi.fn(),
  extractProgressPercent: () => null,
}))
vi.mock('@/layout-mobile/MActionSheet', () => ({ confirmActionSheet: vi.fn() }))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))
vi.mock('@/composables/useSmartBack', () => ({ useSmartBack: () => vi.fn() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: undefined } }),
}))
vi.mock('@/components/common/JsonPreview.vue', () => ({ default: { template: '<div />' } }))

type Job = Awaited<ReturnType<typeof instanceApi.detail>>
function job(tenant: string, status = 'FAILED'): Job {
  return {
    id: 10,
    tenantId: tenant,
    jobCode: `JOB_${tenant}`,
    instanceNo: `${tenant}_10`,
    instanceStatus: status,
    bizDate: '2026-10-20',
  } as Job
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
const wrappers: ReturnType<typeof shallowMount>[] = []
function render() {
  const wrapper = shallowMount(MJobInstanceDetail, {
    global: {
      stubs: {
        MPullRefresh: { template: '<slot />' },
        ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  state.permission = reactive({ allowed: true })
  state.tenant = reactive({ tenantId: 'ta' })
  state.route = reactive({ params: { id: '10' }, query: {} })
  vi.mocked(instanceApi.detail).mockImplementation((_id, tenant) => Promise.resolve(job(tenant)))
  vi.mocked(instanceApi.partitions).mockResolvedValue([])
  vi.mocked(confirmActionSheet).mockResolvedValue('confirm')
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

describe('mobile Job notification target', () => {
  it.each(['FAILED', 'RUNNING'])('无系统写权限时隐藏 %s 的恢复操作', async (status) => {
    state.permission.allowed = false
    vi.mocked(instanceApi.detail).mockResolvedValue(job('ta', status))
    const wrapper = render()
    await flushPromises()
    const actions = wrapper.findAll('button').map((button) => button.text())
    expect(actions).not.toContain('mobile.jobs.retry')
    expect(actions).not.toContain('mobile.jobs.terminate')
  })

  it.each([
    ['retry', 'FAILED'],
    ['terminate', 'RUNNING'],
  ] as const)('确认期间失去写权限后不提交 %s', async (action, status) => {
    vi.mocked(instanceApi.detail).mockResolvedValue(job('ta', status))
    const confirmed = deferred<'confirm'>()
    vi.mocked(confirmActionSheet).mockReturnValue(confirmed.promise)
    const wrapper = render()
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find((candidate) => candidate.text() === `mobile.jobs.${action}`)
    await button!.trigger('click')
    state.permission.allowed = false
    confirmed.resolve('confirm')
    await flushPromises()
    expect(instanceApi[action]).not.toHaveBeenCalled()
  })
  it.each([null, '', ['ta']])(
    'rejects ambiguous or empty notification tenant %s',
    async (query) => {
      state.route.query = { tenantId: query }
      render()
      await flushPromises()
      expect(instanceApi.detail).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['retry', 'FAILED'],
    ['terminate', 'RUNNING'],
  ] as const)('keeps %s on the matching notification target', async (action, status) => {
    state.route.query = { tenantId: 'ta' }
    vi.mocked(instanceApi.detail).mockImplementation((_id, tenant) =>
      Promise.resolve(job(tenant, status)),
    )
    const wrapper = render()
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find((candidate) => candidate.text() === `mobile.jobs.${action}`)
    await button!.trigger('click')
    await flushPromises()
    if (action === 'retry')
      expect(instanceApi.retry).toHaveBeenCalledWith('ta_10', 'ta', 'JOB_ta', '2026-10-20')
    else expect(instanceApi.terminate).toHaveBeenCalledWith(10, 'ta')
  })

  it('does not request a heartbeat for steps returned late from the previous tenant', async () => {
    type Steps = Awaited<ReturnType<typeof instanceApi.partitions>>
    const previous = deferred<Steps>()
    vi.mocked(instanceApi.partitions).mockImplementation((_id, tenant) =>
      tenant === 'ta' ? previous.promise : Promise.resolve([]),
    )
    render()
    await flushPromises()
    state.tenant.tenantId = 'tb'
    await flushPromises()
    previous.resolve([{ jobTaskId: 101, stepStatus: 'RUNNING' }] as unknown as Steps)
    await flushPromises()
    expect(getTaskHeartbeatDetails).not.toHaveBeenCalled()
  })
  it('does not fetch another tenant when a notification link does not match the active tenant', async () => {
    state.route.query = { tenantId: 'tb' }
    const wrapper = render()
    await flushPromises()
    expect(instanceApi.detail).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('mobile.jobDetail.notificationTenantMismatch')
  })

  it('rejects a late response from the previous tenant', async () => {
    const previous = deferred<Job>()
    vi.mocked(instanceApi.detail).mockImplementation((_id, tenant) =>
      tenant === 'ta' ? previous.promise : Promise.resolve(job(tenant)),
    )
    const wrapper = render()
    state.tenant.tenantId = 'tb'
    await flushPromises()
    previous.resolve(job('ta'))
    await flushPromises()
    expect(wrapper.text()).toContain('JOB_tb')
    expect(wrapper.text()).not.toContain('JOB_ta')
    expect(instanceApi.partitions).toHaveBeenCalledTimes(1)
    expect(instanceApi.partitions).toHaveBeenCalledWith(10, 'tb')
  })

  it.each([
    ['retry', 'FAILED'],
    ['terminate', 'RUNNING'],
  ] as const)(
    'does not redirect %s to a new tenant while confirmation is open',
    async (action, status) => {
      vi.mocked(instanceApi.detail).mockImplementation((_id, tenant) =>
        Promise.resolve(job(tenant, status)),
      )
      const confirmed = deferred<'confirm'>()
      vi.mocked(confirmActionSheet).mockReturnValue(confirmed.promise)
      const wrapper = render()
      await flushPromises()
      const button = wrapper
        .findAll('button')
        .find((candidate) => candidate.text() === `mobile.jobs.${action}`)
      expect(button).toBeDefined()
      await button!.trigger('click')
      state.tenant.tenantId = 'tb'
      await flushPromises()
      confirmed.resolve('confirm')
      await flushPromises()
      expect(instanceApi[action]).not.toHaveBeenCalled()
    },
  )
})
