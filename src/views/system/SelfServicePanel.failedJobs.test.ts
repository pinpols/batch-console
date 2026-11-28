// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelfServicePanel from './SelfServicePanel.vue'

const state = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
  permissions: new Set<string>(),
  canManageSystem: false,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: state.query }),
  useRouter: () => ({ push: state.push, replace: state.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'ta' }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { userId: 'u1' },
    hasPermission: (perm: string) => state.permissions.has(perm),
  }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canManageSystem: ref(state.canManageSystem) }),
}))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))
vi.mock('@/composables/useDrawerAutoClose', () => ({ useDrawerAutoClose: vi.fn() }))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: vi.fn().mockResolvedValue({ total: 0, items: [] }),
}))

const slot = { template: '<div><slot name="actions" /><slot /></div>' }

function mountPanel() {
  return mount(SelfServicePanel, {
    global: {
      stubs: {
        PageContainer: slot,
        PageHeader: slot,
        SectionCard: slot,
        ElButton: slot,
        ElIcon: slot,
        ElTag: slot,
        ElCollapseTransition: slot,
        ElDrawer: {
          props: ['modelValue'],
          template: '<div class="drawer" :data-open="modelValue"><slot /></div>',
        },
        SelfServiceQuotaTab: true,
        SelfServiceQuotaChangeTab: true,
        SelfServiceRerunTab: true,
        SelfServiceCompensationTab: true,
        SelfServiceNotifSubsTab: true,
        SelfServiceMyAuditsTab: true,
        SelfServiceTriggerPauseTab: true,
      },
    },
  })
}

describe('SelfServicePanel 失败作业卡片跳转', () => {
  beforeEach(() => {
    state.query = {}
    state.push.mockReset()
    state.replace.mockReset()
    state.permissions = new Set(['ROLE_TENANT_USER'])
    state.canManageSystem = false
  })

  it('点击失败作业卡片直接跳转到带失败筛选的作业运行列表', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    const failedCard = wrapper
      .findAll('.service-card')
      .find((card) => card.text().includes('selfServicePanel.tabFailedJobs'))!

    await failedCard.trigger('click')
    expect(state.push).toHaveBeenCalledWith({
      path: '/monitor/job-instances',
      query: { statuses: 'FAILED,PARTIAL_FAILED', range: 'all' },
    })
    expect(wrapper.get('.drawer').attributes('data-open')).toBe('false')
  })

  it('旧深链 ?action=failedJobs 重定向到带失败筛选的作业运行列表', async () => {
    state.query = { action: 'failedJobs' }
    mountPanel()
    await flushPromises()
    expect(state.replace).toHaveBeenCalledWith({
      path: '/monitor/job-instances',
      query: { statuses: 'FAILED,PARTIAL_FAILED', range: 'all' },
    })
  })

  it('租户用户点击重跑/补偿仍打开申请抽屉，平台/租户管理员直达操作页', async () => {
    const tenantUserWrapper = mountPanel()
    await flushPromises()
    const rerunCard = tenantUserWrapper
      .findAll('.service-card')
      .find((card) => card.text().includes('selfServicePanel.tabRerun'))!
    await rerunCard.trigger('click')
    expect(tenantUserWrapper.get('.drawer').attributes('data-open')).toBe('true')

    state.permissions = new Set(['ROLE_ADMIN'])
    state.canManageSystem = true
    state.push.mockReset()
    const adminWrapper = mountPanel()
    await flushPromises()
    const adminRerun = adminWrapper
      .findAll('.service-card')
      .find((card) => card.text().includes('selfServicePanel.tabRerun'))!
    await adminRerun.trigger('click')
    expect(state.push).toHaveBeenCalledWith({ path: '/monitor/job-instances' })

    const triggerCard = adminWrapper
      .findAll('.service-card')
      .find((card) => card.text().includes('selfServicePanel.tabTriggerPause'))!
    await triggerCard.trigger('click')
    expect(state.push).toHaveBeenCalledWith({ path: '/system/triggers' })
  })
})
