// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import RunsOverview from './RunsOverview.vue'

const state = vi.hoisted(() => ({
  jobs: vi.fn(),
  workflows: vi.fn(),
  tenant: { tenantId: 'tenant-a' },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/api/instance', () => ({
  instanceApi: { list: state.jobs, workflowRuns: state.workflows },
}))
const slot = { template: '<div><slot /><slot name="actions" /></div>' }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it('租户切换后，先前请求的迟到结果不能覆盖当前租户的列表和统计', async () => {
  state.tenant = reactive({ tenantId: 'tenant-a' })
  const oldJobs = deferred<unknown>()
  const oldWorkflows = deferred<unknown>()
  const oldCounts = deferred<unknown>()
  state.jobs.mockReset().mockImplementation((query: { tenantId: string; pageSize: number }) => {
    if (query.tenantId === 'tenant-a')
      return query.pageSize === 15 ? oldJobs.promise : oldCounts.promise
    return Promise.resolve({
      total: 2,
      records: [{ id: 2, jobCode: 'JOB-B', instanceStatus: 'RUNNING' }],
    })
  })
  state.workflows.mockReset().mockImplementation((query: { tenantId: string }) =>
    query.tenantId === 'tenant-a'
      ? oldWorkflows.promise
      : Promise.resolve({
          total: 1,
          records: [{ id: 2, currentNodeCode: 'STEP-B', runStatus: 'RUNNING' }],
        }),
  )
  const wrapper = mount(RunsOverview, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        PageContainer: slot,
        PageHeader: slot,
        StatusSegment: true,
        ElButton: true,
        ElPopover: true,
        ElIcon: true,
        RouterLink: true,
      },
    },
  })
  state.tenant.tenantId = 'tenant-b'
  await flushPromises()
  expect(wrapper.text()).toContain('JOB-B')
  expect(wrapper.text()).toContain('STEP-B')
  oldJobs.resolve({ total: 1, records: [{ id: 1, jobCode: 'JOB-A', instanceStatus: 'RUNNING' }] })
  oldWorkflows.resolve({
    total: 1,
    records: [{ id: 1, currentNodeCode: 'STEP-A', runStatus: 'RUNNING' }],
  })
  oldCounts.resolve({ total: 99, records: [] })
  await flushPromises()
  expect(wrapper.text()).toContain('JOB-B')
  expect(wrapper.text()).toContain('STEP-B')
  expect(wrapper.text()).not.toContain('JOB-A')
  expect(wrapper.text()).not.toContain('STEP-A')
  expect(wrapper.findAll('.ro-stat__num').map((node) => node.text())).toEqual(['2', '2', '2', '2'])
  state.tenant.tenantId = ''
  await flushPromises()
  expect(wrapper.text()).not.toContain('JOB-B')
  expect(wrapper.text()).not.toContain('STEP-B')
  expect(wrapper.findAll('.ro-stat__num').map((node) => node.text())).toEqual(['—', '—', '—', '—'])
  wrapper.unmount()
})
