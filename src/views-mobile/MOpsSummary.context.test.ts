// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import MOpsSummary from './MOpsSummary.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  getSummary: vi.fn(),
  error: vi.fn(),
  refresh: null as unknown as () => Promise<void>,
  permission: null as unknown as { visibleGroups: Array<{ children: Array<{ path: string }> }> },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/permission', () => ({ usePermissionStore: () => mocks.permission }))
vi.mock('@/api/ops', () => ({ getOpsSummary: mocks.getSummary }))
vi.mock('@/composables/useAutoRefresh', () => ({
  useAutoRefresh: (fn: () => Promise<void>) => {
    mocks.refresh = fn
  },
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: mocks.error },
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.permission = reactive({ visibleGroups: [] })
  mocks.getSummary.mockReset()
  mocks.error.mockReset()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}
function setup() {
  return shallowMount(MOpsSummary, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
        MSkeleton: { template: '<div data-loading>loading</div>' },
        MTenantDailyProgress: { template: '<div data-daily />' },
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}
function running(wrapper: ReturnType<typeof setup>) {
  return wrapper.find('.m-metric__value').text()
}

describe('mobile operations summary context', () => {
  it('shows a retryable error instead of an empty summary after a failed request', async () => {
    mocks.getSummary
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ runningJobs: 22 })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.common.empty')
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(running(wrapper)).toBe('22')
  })

  it.each([
    [
      'ADMIN',
      ['/files/list', '/approvals', '/observability/outbox', '/workers/management'],
      ['/m/files', '/m/approvals?tab=catch-up', '/m/outbox'],
      true,
    ],
    [
      'TENANT_ADMIN',
      ['/files/list', '/approvals', '/observability/outbox', '/workers/management'],
      ['/m/files', '/m/approvals?tab=catch-up', '/m/outbox'],
      true,
    ],
    ['AUDITOR', ['/files/list'], ['/m/files'], false],
    ['TENANT_USER', ['/files/list'], ['/m/files'], false],
    ['unconfirmed', [], [], false],
  ] as const)(
    'limits quick links and metric navigation to %s visible menus',
    async (_role, paths, quickPaths, canManage) => {
      mocks.permission.visibleGroups = [{ children: paths.map((path) => ({ path })) }]
      mocks.getSummary.mockResolvedValue({
        runningJobs: 11,
        pendingApprovals: 4,
        onlineWorkers: 2,
        drainingWorkers: 1,
        offlineWorkers: 3,
      })
      const wrapper = setup()
      await flushPromises()
      expect(wrapper.findAll('.m-quick').map((link) => link.attributes('href'))).toEqual(quickPaths)
      const metrics = wrapper.findAll('.m-metric')
      expect(metrics[2].text()).toContain('4')
      expect(metrics[2].attributes('href')).toBe(canManage ? '/m/approvals' : undefined)
      expect(metrics[5].text()).toContain('2')
      expect(metrics[5].attributes('href')).toBe(canManage ? '/m/workers?filter=online' : undefined)
      expect(metrics[6].attributes('href')).toBe(
        canManage ? '/m/workers?filter=draining' : undefined,
      )
      expect(metrics[7].attributes('href')).toBe(
        canManage ? '/m/workers?filter=offline' : undefined,
      )
    },
  )

  it('withdraws links immediately when the current menu profile is invalidated', async () => {
    mocks.permission.visibleGroups = [
      { children: ['/files/list', '/approvals', '/workers/management'].map((path) => ({ path })) },
    ]
    mocks.getSummary.mockResolvedValue({ runningJobs: 11, pendingApprovals: 4, onlineWorkers: 2 })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('.m-quick[href="/m/approvals?tab=catch-up"]').exists()).toBe(true)
    expect(wrapper.find('.m-metric[href="/m/approvals"]').exists()).toBe(true)
    mocks.permission.visibleGroups = []
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.m-quick')).toHaveLength(0)
    expect(wrapper.find('.m-metric[href="/m/approvals"]').exists()).toBe(false)
    expect(wrapper.findAll('.m-metric')[2].text()).toContain('4')
  })

  it('keeps the new tenant loading and discards an earlier tenant response', async () => {
    const old = deferred<{ runningJobs: number }>()
    const current = deferred<{ runningJobs: number }>()
    mocks.getSummary.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await wrapper.vm.$nextTick()
    old.resolve({ runningJobs: 11 })
    await flushPromises()
    expect(wrapper.find('[data-loading]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('11')
    current.resolve({ runningJobs: 22 })
    await flushPromises()
    expect(running(wrapper)).toBe('22')
  })

  it('keeps new tenant metrics when the previous tenant succeeds late', async () => {
    const old = deferred<{ runningJobs: number }>()
    mocks.getSummary.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ runningJobs: 22 })
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(running(wrapper)).toBe('22')
    old.resolve({ runningJobs: 11 })
    await flushPromises()
    expect(running(wrapper)).toBe('22')
  })

  it('keeps current metrics when the previous tenant finishes or fails late', async () => {
    const old = deferred<{ runningJobs: number }>()
    mocks.getSummary.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ runningJobs: 22 })
    const wrapper = setup()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(running(wrapper)).toBe('22')
    old.reject(new Error('stale failure'))
    await flushPromises()
    expect(running(wrapper)).toBe('22')
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('keeps the newest same-tenant refresh when responses arrive out of order', async () => {
    const first = deferred<{ runningJobs: number }>()
    const second = deferred<{ runningJobs: number }>()
    mocks.getSummary.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = setup()
    const later = mocks.refresh()
    second.resolve({ runningJobs: 22 })
    await later
    first.resolve({ runningJobs: 11 })
    await flushPromises()
    expect(running(wrapper)).toBe('22')
  })
})
