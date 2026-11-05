// @vitest-environment jsdom
import { fmtDatetime } from '@/utils/datetime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { computed, defineComponent, provide, reactive } from 'vue'
import TraceDiagnostic from './TraceDiagnostic.vue'
import CopyableText from '@/components/common/CopyableText.vue'

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
  it('可只读查看动态列的完整操作、聚合类型、事件类型和告警类型', async () => {
    const action = 'action-' + 'a'.repeat(100)
    const aggregateType = 'aggregate-' + 'b'.repeat(40)
    const eventType = 'event-' + 'c'.repeat(50)
    const alertType = 'BATCH_CALENDAR_DEPENDENCY_WAIT_TIMEOUT'
    mocks.load.mockResolvedValue({
      operationAudits: [{ action, aggregateType }],
      outboxDeliveries: [{ eventType }],
      alerts: [{ alertType }],
    })
    const table = defineComponent({
      props: { data: { type: Array, required: true } },
      setup(props) {
        provide(
          'trace-test-row',
          computed(() => props.data[0]),
        )
      },
      template: '<div><slot /></div>',
    })
    const column = {
      inject: { row: { from: 'trace-test-row' } },
      template: '<div><slot :row="row" /></div>',
    }
    const wrapper = shallowMount(TraceDiagnostic, {
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
          ElTable: table,
          ElTableColumn: column,
          ElResult: slot,
          RouterLink: slot,
        },
      },
    })
    try {
      await flushPromises()
      const previews = wrapper.findAllComponents(CopyableText)
      for (const value of [action, aggregateType, eventType, alertType]) {
        const preview = previews.find((component) => component.props('text') === value)
        expect(preview, value).toBeDefined()
        expect(preview?.props('copyable')).toBe(false)
      }
    } finally {
      wrapper.unmount()
    }
  })

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

  it('时间线时间按系统时区格式化，不直接显示后端 ISO 原文', async () => {
    mocks.load.mockResolvedValue({
      timeline: [
        { source: 'JOB_INSTANCE', eventType: 'STATUS', occurredAt: '2026-11-03T03:26:35.031552Z' },
      ],
    })
    const wrapper = render()
    await flushPromises()
    const stamp = wrapper.find('.trace-timeline [timestamp]').attributes('timestamp')
    expect(stamp).toBe(fmtDatetime('2026-11-03T03:26:35.031552Z'))
    expect(stamp).not.toContain('T03:26')
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
