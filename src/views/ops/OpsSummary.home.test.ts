// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import zhCN from '@/locales/zh-CN'
import OpsSummary from './OpsSummary.vue'

const tenantState = vi.hoisted(() => ({ tenantId: 'tenant-a' as string | null }))
const tabState = vi.hoisted(() => ({ tab: 'kpis' }))
const refreshSpies = vi.hoisted(() => ({
  daily: vi.fn(),
  onboarding: vi.fn(),
  summary: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({
  useTenantStore: () => ({
    get tenantId() {
      return tenantState.tenantId
    },
  }),
}))
vi.mock('@/composables/useDailyProgress', () => ({
  useDailyProgress: () => ({
    progress: ref(null),
    status: ref('live'),
    loading: ref(false),
    error: ref(null),
    lastRefreshedAt: ref(null),
    refresh: refreshSpies.daily,
  }),
}))
vi.mock('@/composables/useOnboardingChecklist', () => ({
  useOnboardingChecklist: () => ({
    role: ref('ROLE_ADMIN'),
    evidence: ref({ failedSources: [] }),
    checklist: ref({ activated: false, completedCount: 1, totalCount: 5, steps: [] }),
    loading: ref(false),
    collapsed: ref(false),
    progressPercentage: ref(20),
    load: refreshSpies.onboarding,
    setCollapsed: vi.fn(),
    trackStepAction: vi.fn(),
  }),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('./composables/useOpsSummary', () => ({
  useOpsSummary: () => ({
    loading: ref(false),
    summary: ref({}),
    opsTab: ref(tabState.tab),
    rangeKey: ref('7d'),
    chartsLoading: ref(false),
    chartTheme: ref('console-light'),
    jobsTrendOption: ref({}),
    alertsTrendOption: ref({}),
    slaTrendOption: ref({}),
    failRateTrendOption: ref({}),
    triggerTypeTopNOption: ref({}),
    workerLoadTopNOption: ref({}),
    jobStatusOption: ref({}),
    workerStatusOption: ref({}),
    alertSeverityOption: ref({}),
    outboxHealthOption: ref({}),
    slaGaugeOption: ref({}),
    extraLoading: ref(false),
    slaReport: ref(null),
    tenantUsage: ref(null),
    slaReportError: ref(null),
    tenantUsageError: ref(null),
    load: refreshSpies.summary,
    loadCharts: vi.fn(),
    loadExtraPanels: vi.fn(),
    go: vi.fn(),
    goFailedJobs: vi.fn(),
  }),
}))

enableAutoUnmount(afterEach)
afterEach(() => {
  tenantState.tenantId = 'tenant-a'
  tabState.tab = 'kpis'
  vi.clearAllMocks()
})

const slotStub = { template: '<div><slot /></div>' }

function mountHome() {
  return mount(OpsSummary, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN } })],
      stubs: {
        PageContainer: slotStub,
        PageHeader: { template: '<div><slot name="actions" /><slot /></div>' },
        PrintButton: true,
        OpsMetricGrid: true,
        DocsDrawer: true,
        LiveStatusBadge: true,
        DataState: slotStub,
        ElCard: {
          template:
            '<div class="el-card"><div v-if="$slots.header" class="el-card__header"><slot name="header" /></div><div class="el-card__body"><slot /></div></div>',
        },
        ElButton: { template: '<button><slot /></button>' },
        ElDatePicker: true,
        ElAlert: true,
        ElProgress: true,
        ElTag: true,
        ElIcon: slotStub,
        ElTabs: slotStub,
        ElTabPane: true,
      },
    },
  })
}

describe('首页今日进度与快速开始页签', () => {
  it('默认卡片指标页签下不渲染今日进度与快速开始', () => {
    const wrapper = mountHome()
    const panels = wrapper.get('.ops-panels')
    expect(panels.text()).not.toContain('租户今日计划与执行')
    expect(panels.find('[data-onboarding="onboarding-center"]').exists()).toBe(false)
  })

  it('今日进度页签只渲染租户今日计划与执行卡片', () => {
    tabState.tab = 'daily'
    const wrapper = mountHome()
    const panels = wrapper.get('.ops-panels')
    expect(panels.get('.el-card__header').text()).toContain('租户今日计划与执行')
    expect(panels.find('[data-onboarding="onboarding-center"]').exists()).toBe(false)
  })

  it('快速开始页签只渲染引导中心卡片', () => {
    tabState.tab = 'onboarding'
    const wrapper = mountHome()
    const panels = wrapper.get('.ops-panels')
    const onboarding = panels.get('[data-onboarding="onboarding-center"]')
    expect(onboarding.get('h2').text()).toBe('首条链路')
    expect(panels.text()).not.toContain('租户今日计划与执行')
  })

  it('无租户时今日进度不渲染', () => {
    tabState.tab = 'daily'
    tenantState.tenantId = null
    const wrapper = mountHome()
    expect(wrapper.get('.ops-panels').text()).not.toContain('租户今日计划与执行')
  })

  it('顶部刷新按钮在今日进度页签只刷新进度', async () => {
    tabState.tab = 'daily'
    const wrapper = mountHome()
    const topRefresh = wrapper.findAll('button').find((button) => button.text() === '刷新')
    await topRefresh!.trigger('click')
    expect(refreshSpies.daily).toHaveBeenCalledTimes(1)
    expect(refreshSpies.summary).not.toHaveBeenCalled()
  })

  it('顶部刷新按钮在快速开始页签只重载引导', async () => {
    tabState.tab = 'onboarding'
    const wrapper = mountHome()
    const topRefresh = wrapper.findAll('button').find((button) => button.text() === '刷新')
    await topRefresh!.trigger('click')
    expect(refreshSpies.onboarding).toHaveBeenCalledTimes(1)
    expect(refreshSpies.summary).not.toHaveBeenCalled()
  })
})
