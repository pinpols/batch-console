// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { getWorkerFingerprintSummary, listWorkerFingerprints } from '@/api/workerFingerprint'
import zhCN from '@/locales/zh-CN'
import WorkerFingerprintBoard from './WorkerFingerprintBoard.vue'

vi.mock('@/api/workerFingerprint', () => ({
  getWorkerFingerprintSummary: vi.fn(),
  listWorkerFingerprints: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: () => {} }))

enableAutoUnmount(afterEach)
const slotStub = { template: '<div><slot name="header" /><slot /></div>' }
function renderPage() {
  return mount(WorkerFingerprintBoard, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })],
      stubs: {
        PageContainer: slotStub,
        PageHeader: slotStub,
        SectionCard: slotStub,
        HelpLabel: slotStub,
        ProTable: slotStub,
        EmptyState: { name: 'EmptyState', template: '<div>无数据</div>' },
        MetricCard: true,
        CopyableText: true,
        ElSwitch: true,
        ElButton: slotStub,
        ElTag: slotStub,
        ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
        ElProgress: true,
        ElTableColumn: true,
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(listWorkerFingerprints).mockReset().mockResolvedValue([])
  vi.mocked(getWorkerFingerprintSummary).mockReset()
})

describe('Worker 指纹摘要', () => {
  it('摘要成功时同时展示指标与指纹分组', async () => {
    vi.mocked(getWorkerFingerprintSummary).mockResolvedValue([
      { buildId: 'build-a', sdkVersion: '1.0', count: 2 },
    ])
    const page = renderPage()
    await flushPromises()
    expect(page.find('.wfb__metrics').exists()).toBe(true)
    expect(page.findAll('.wfb__card')).toHaveLength(1)
    expect(page.get('.wfb__card').text()).toContain('build-a')
  })

  it('摘要失败时只提示失败，不显示无数据', async () => {
    vi.mocked(getWorkerFingerprintSummary).mockRejectedValue(new Error('unavailable'))
    const page = renderPage()
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toBe(zhCN.workerFingerprintBoard.summaryLoadError)
    expect(page.findComponent({ name: 'EmptyState' }).exists()).toBe(false)
    expect(page.find('.wfb__cards').exists()).toBe(false)
  })

  it('摘要为空时显示空状态', async () => {
    vi.mocked(getWorkerFingerprintSummary).mockResolvedValue([])
    const page = renderPage()
    await flushPromises()
    expect(page.findComponent({ name: 'EmptyState' }).exists()).toBe(true)
    expect(page.find('.wfb__cards').exists()).toBe(false)
  })
})
