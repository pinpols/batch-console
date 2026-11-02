// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RunsOverview from './RunsOverview.vue'

const state = vi.hoisted(() => ({ jobs: vi.fn(), workflows: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/api/instance', () => ({
  instanceApi: { list: state.jobs, workflowRuns: state.workflows },
}))
const slot = { template: '<div><slot /><slot name="actions" /></div>' }
function render() {
  return mount(RunsOverview, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        PageContainer: slot,
        PageHeader: slot,
        StatusSegment: true,
        ElButton: { template: '<button><slot /></button>' },
        ElPopover: { template: '<span><slot name="reference" /><slot /></span>' },
        ElIcon: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}
const job = {
  id: 7,
  jobCode: 'JOB-A',
  instanceNo: 'RUN-A',
  bizDate: '2026-11-02',
  instanceStatus: 'RUNNING',
}
const workflow = { id: 8, currentNodeCode: 'STEP-A', runStatus: 'RUNNING' }

describe('运行总览加载失败', () => {
  beforeEach(() => {
    state.jobs.mockReset().mockResolvedValue({ total: 1, records: [job] })
    state.workflows.mockReset().mockResolvedValue({ total: 1, records: [workflow] })
  })

  it('作业加载失败时保留工作流结果，并可单独重试', async () => {
    state.jobs.mockImplementationOnce(() => Promise.reject(new Error('network failure')))
    const wrapper = render()
    await flushPromises()
    const cards = wrapper.findAll('.ro-card')
    expect(cards[0].get('[role="alert"]').text()).toContain('runsOverview.loadFailed')
    expect(cards[1].text()).toContain('STEP-A')
    await cards[0].get('button').trigger('click')
    await flushPromises()
    expect(cards[0].text()).toContain('JOB-A')
    expect(state.workflows).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('工作流加载失败时保留作业结果，并可单独重试', async () => {
    state.workflows.mockRejectedValueOnce(new Error('network failure'))
    const wrapper = render()
    await flushPromises()
    const cards = wrapper.findAll('.ro-card')
    expect(cards[1].get('[role="alert"]').text()).toContain('runsOverview.loadFailed')
    expect(cards[0].text()).toContain('JOB-A')
    await cards[1].get('button').trigger('click')
    await flushPromises()
    expect(cards[1].text()).toContain('STEP-A')
    expect(state.workflows).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
