// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import TraceDiagnostic from './TraceDiagnostic.vue'

const mocks = vi.hoisted(() => ({ load: vi.fn(), tenant: null as unknown as { tenantId: string } }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { traceId: 'trace-a' } }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/api/observabilityQueries', () => ({ queryTraceSnapshot: mocks.load }))
const slot = { template: '<div><slot /><slot name="header" /><slot name="sub-title" /></div>' }

function render() {
  return shallowMount(TraceDiagnostic, {
    global: {
      stubs: {
        PageContainer: slot,
        SectionCard: slot,
        ElTimeline: slot,
        ElTimelineItem: slot,
        ElCollapse: slot,
        ElCollapseItem: slot,
        ElButton: slot,
        ElAlert: slot,
        ElTable: slot,
        ElResult: slot,
      },
    },
  })
}

beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.load.mockReset()
})

describe('TraceDiagnostic', () => {
  it('renders server timeline fields and retains the domain tables', async () => {
    mocks.load.mockResolvedValue({
      jobInstances: [{ id: 1, instanceNo: 'table-job', startedAt: '2026-01-01T10:00:00Z' }],
      files: [{ id: 2, fileName: 'table-file' }],
      timeline: [
        {
          source: 'FILE_RECORD',
          eventType: 'STATUS',
          referenceId: 2,
          status: 'READY',
          message: 'event-file',
          occurredAt: '2026-01-01T09:00:00Z',
        },
        {
          source: 'JOB_INSTANCE',
          eventType: 'STATUS',
          referenceId: 1,
          status: 'RUNNING',
          message: 'event-job',
          occurredAt: '2026-01-01T10:00:00Z',
        },
      ],
    })
    const wrapper = render()
    await flushPromises()
    expect(mocks.load).toHaveBeenCalledWith('tenant-a', 'trace-a')
    const text = wrapper.find('.trace-timeline').text()
    expect(text.indexOf('event-file')).toBeLessThan(text.indexOf('event-job'))
    expect(text).toContain('traceDiagnostic.domainFile')
    expect(text).toContain('READY')
    expect(text).not.toContain('table-file')
    expect(wrapper.find('.trace-domains').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows unavailable when an older response omits the timeline', async () => {
    mocks.load.mockResolvedValue({ jobInstances: [{ id: 1, instanceNo: 'job' }] })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('.trace-timeline').text()).toContain('traceDiagnostic.timelineUnavailable')
    wrapper.unmount()
  })

  it('shows events even when no domain rows are returned', async () => {
    mocks.load.mockResolvedValue({
      timeline: [
        { source: 'SERVER_ONLY', eventType: 'STATUS', occurredAt: '2026-01-01T09:00:00Z' },
      ],
    })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('.trace-timeline').text()).toContain('SERVER_ONLY')
    wrapper.unmount()
  })

  it('reports a missing timeline even when no domain rows are returned', async () => {
    mocks.load.mockResolvedValue({})
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('traceDiagnostic.timelineUnavailable')
    wrapper.unmount()
  })

  it('discards a late response after the tenant changes', async () => {
    let resolve!: (value: unknown) => void
    mocks.load.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = render()
    await flushPromises()
    mocks.tenant.tenantId = 'tenant-b'
    resolve({
      jobInstances: [{ id: 1 }],
      timeline: [{ source: 'OLD_TENANT', eventType: 'STATUS', occurredAt: '2026-01-01T09:00:00Z' }],
    })
    await flushPromises()
    expect(wrapper.text()).not.toContain('OLD_TENANT')
    expect(wrapper.find('.trace-timeline').exists()).toBe(false)
    wrapper.unmount()
  })
})
