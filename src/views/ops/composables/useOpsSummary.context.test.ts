// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpsSummary } from './useOpsSummary'

const state = vi.hoisted(() => ({
  tenant: { tenantId: 'tenant-a' },
  summary: vi.fn(),
  bundle: vi.fn(),
  sla: vi.fn(),
  usage: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/ops', () => ({ getOpsSummary: state.summary }))
vi.mock('@/api/dashboard', () => ({
  getDashboardBundle: state.bundle,
  getDashboardSlaReport: state.sla,
  getDashboardTenantUsage: state.usage,
}))
vi.mock('@/utils/logger', () => ({ logError: vi.fn() }))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn() },
  ElNotification: { error: vi.fn() },
}))

const bundle = {
  jobs: { labels: ['day'], series: { running: [1], failed: [0] } },
  alerts: { labels: [], series: { open: [], acked: [], closed: [] } },
  sla: { labels: [], series: { onTime: [], violation: [] }, totalWithSla: 0 },
  triggerTypes: { items: [] },
  workerLoads: { items: [] },
}
const snapshot = (runningJobs: number) => ({
  runningJobs,
  failedJobs: 0,
  slaBreaches: 0,
  onlineWorkers: 0,
  drainingWorkers: 0,
  offlineWorkers: 0,
  openAlerts: 0,
  criticalAlerts: 0,
  outboxRetryBacklog: 0,
  outboxDeliveryFailures: 0,
  pendingApprovals: 0,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function render() {
  let vm!: ReturnType<typeof useOpsSummary>
  const wrapper = mount(
    defineComponent({
      setup() {
        vm = useOpsSummary()
        return () => null
      },
    }),
  )
  return { wrapper, vm }
}
beforeEach(() => {
  state.tenant = reactive({ tenantId: 'tenant-a' })
  state.summary.mockReset().mockResolvedValue(snapshot(1))
  state.bundle.mockReset().mockResolvedValue(bundle)
  state.sla.mockReset().mockResolvedValue({ label: 'report-a' })
  state.usage.mockReset().mockResolvedValue({ label: 'usage-a' })
})
describe('运维概览租户上下文', () => {
  it('切换租户后迟到的旧汇总不会覆盖新租户', async () => {
    const old = deferred<ReturnType<typeof snapshot>>()
    state.summary.mockImplementation((tenant: string) =>
      tenant === 'tenant-a' ? old.promise : Promise.resolve(snapshot(2)),
    )
    const { vm, wrapper } = render()
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(vm.summary.value?.runningJobs).toBe(2)
    old.resolve(snapshot(1))
    await flushPromises()
    expect(vm.summary.value?.runningJobs).toBe(2)
    wrapper.unmount()
  })
  it('切换租户后迟到的旧趋势不会覆盖新租户图表', async () => {
    const old = deferred<typeof bundle>()
    state.bundle.mockImplementation((tenant: string) =>
      tenant === 'tenant-a'
        ? old.promise
        : Promise.resolve({
            ...bundle,
            jobs: { labels: ['day'], series: { running: [2], failed: [0] } },
          }),
    )
    const { vm, wrapper } = render()
    await flushPromises()
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    old.resolve(bundle)
    await flushPromises()
    const chart = vm.jobsTrendOption.value as { series: Array<{ data: number[] }> }
    expect(chart.series[0].data).toEqual([2])
    wrapper.unmount()
  })
  it('未选择租户时清除旧汇总且旧请求不会回填', async () => {
    const old = deferred<ReturnType<typeof snapshot>>()
    state.summary.mockImplementation(() => old.promise)
    const { vm, wrapper } = render()
    state.tenant.tenantId = ''
    expect(vm.summary.value).toBeNull()
    old.resolve(snapshot(1))
    await flushPromises()
    expect(vm.summary.value).toBeNull()
    expect(vm.loading.value).toBe(false)
    wrapper.unmount()
  })
  it('同一租户连续刷新时迟到的旧结果不能覆盖新汇总', async () => {
    const old = deferred<ReturnType<typeof snapshot>>()
    state.summary.mockReturnValueOnce(old.promise).mockResolvedValue(snapshot(2))
    const { vm, wrapper } = render()
    await vm.load()
    old.resolve(snapshot(1))
    await flushPromises()
    expect(vm.summary.value?.runningJobs).toBe(2)
    wrapper.unmount()
  })
  it('切换趋势时间范围后迟到的旧结果不会覆盖当前范围', async () => {
    const old = deferred<typeof bundle>()
    state.bundle.mockImplementation((_tenant: string, days: number) =>
      days === 1
        ? old.promise
        : Promise.resolve({
            ...bundle,
            jobs: { labels: ['day'], series: { running: [7], failed: [0] } },
          }),
    )
    const { vm, wrapper } = render()
    await flushPromises()
    vm.rangeKey.value = '24h'
    await flushPromises()
    old.resolve(bundle)
    await flushPromises()
    const chart = vm.jobsTrendOption.value as { series: Array<{ data: number[] }> }
    expect(chart.series[0].data).toEqual([7])
    wrapper.unmount()
  })
  it('扩展页打开时切租户清空旧值并加载新报告', async () => {
    const next = deferred<{ label: string }>()
    state.sla.mockImplementation((tenant: string) =>
      tenant === 'tenant-b' ? next.promise : Promise.resolve({ label: 'report-a' }),
    )
    const { vm, wrapper } = render()
    await flushPromises()
    vm.opsTab.value = 'extra'
    await vm.loadExtraPanels()
    state.tenant.tenantId = 'tenant-b'
    expect(vm.slaReport.value).toBeNull()
    expect(vm.extraLoading.value).toBe(true)
    next.resolve({ label: 'report-b' })
    await flushPromises()
    expect(vm.slaReport.value).toEqual({ label: 'report-b' })
    wrapper.unmount()
  })
  it('切换租户后迟到的旧扩展报告不会覆盖新数据', async () => {
    const old = deferred<{ label: string }>()
    state.sla.mockImplementation((tenant: string) =>
      tenant === 'tenant-a' ? old.promise : Promise.resolve({ label: 'report-b' }),
    )
    const { vm, wrapper } = render()
    await flushPromises()
    void vm.loadExtraPanels()
    state.tenant.tenantId = 'tenant-b'
    await flushPromises()
    await vm.loadExtraPanels()
    old.resolve({ label: 'report-a' })
    await flushPromises()
    expect(vm.slaReport.value).toEqual({ label: 'report-b' })
    wrapper.unmount()
  })
})
