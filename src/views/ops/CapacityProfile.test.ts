// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getCapacityProfile } from '@/api/capacityProfile'
import zhCN from '@/locales/zh-CN'
import CapacityProfile from './CapacityProfile.vue'

vi.mock('@/api/capacityProfile', () => ({ getCapacityProfile: vi.fn() }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ theme: 'light' }) }))
vi.mock('vue-echarts', () => ({ default: { name: 'VChart', template: '<div />' } }))
vi.mock('element-plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn() },
}))

enableAutoUnmount(afterEach)
const report = {
  generatedAt: '2026-11-02T00:00:00Z',
  tenantId: 'tenant-a',
  window: { from: '2026-10-26T00:00:00Z', to: '2026-11-02T00:00:00Z' },
  groupBy: 'TENANT' as const,
  scope: 'TENANT',
  rows: [],
  coverage: {},
  totals: {
    instanceCount: 10,
    taskCount: 20,
    successCount: 10,
    failureCount: 0,
    totalDurationMs: 1000,
    totalFileBytes: 0,
    processedRecords: 0,
  },
}
const slotStub = { template: '<div><slot name="header" /><slot /></div>' }

function renderPage() {
  return mount(CapacityProfile, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })],
      directives: { loading: () => {} },
      stubs: {
        RelatedPageLinks: true,
        PageContainer: slotStub,
        PageHeader: true,
        SectionCard: slotStub,
        ListPageQueryBar: slotStub,
        MetricCard: true,
        EmptyState: true,
        InstantRangePicker: true,
        VChart: true,
        ElAlert: { props: ['title'], template: '<aside>{{ title }}</aside>' },
        ElFormItem: slotStub,
        ElSegmented: true,
        ElInputNumber: true,
        ElCollapse: slotStub,
        ElCollapseItem: slotStub,
        ElTable: true,
        ElTag: true,
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(getCapacityProfile).mockReset().mockResolvedValue(report)
  vi.mocked(ElMessage.success).mockReset()
  vi.mocked(ElMessage.warning).mockReset()
})

describe('容量画像趋势加载', () => {
  it('部分时间段失败时保留总览并提示趋势不完整', async () => {
    vi.mocked(getCapacityProfile)
      .mockResolvedValueOnce(report)
      .mockRejectedValueOnce(new Error('unavailable'))
    const page = renderPage()
    await flushPromises()
    expect(page.text()).toContain(zhCN.capacityProfile.trendIncomplete)
    expect(page.findAllComponents({ name: 'MetricCard' })).toHaveLength(4)
    expect(ElMessage.warning).toHaveBeenCalledWith(zhCN.capacityProfile.trendIncomplete)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('全部时间段成功时不显示缺失提示', async () => {
    const page = renderPage()
    await flushPromises()
    expect(page.text()).not.toContain(zhCN.capacityProfile.trendIncomplete)
    expect(ElMessage.success).toHaveBeenCalledWith(zhCN.capacityProfile.loadOk)
    expect(ElMessage.warning).not.toHaveBeenCalled()
  })
})
