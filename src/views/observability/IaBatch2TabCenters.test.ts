// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditCenter from './AuditCenter.vue'
import AlertPolicyCenter from './AlertPolicyCenter.vue'
import UsageAnalyticsCenter from './UsageAnalyticsCenter.vue'
import ShardManagementCenter from '@/views/ops/ShardManagementCenter.vue'

const state = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
  permissions: new Set<string>(),
  minRoles: new Set<string>(),
  allowedPaths: new Set<string>(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: state.query }),
  useRouter: () => ({ push: state.push, replace: state.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    hasPermission: (perm: string) => state.permissions.has(perm),
  }),
}))
vi.mock('@/stores/permission', () => ({
  usePermissionStore: () => ({
    canAccessRole: (role: string) => state.minRoles.has(role),
  }),
}))
vi.mock('@/composables/useRouteAccess', () => ({
  useRouteAccess: () => ({
    canOpenPath: (path: string) => state.allowedPaths.has(path),
  }),
}))

const slot = { template: '<div><slot name="actions" /><slot /></div>' }
const tabPane = {
  props: ['name', 'label'],
  template: '<section class="tab-pane" :data-tab="name">{{ label }}<slot /></section>',
}

const commonStubs = {
  PageContainer: slot,
  PageHeader: slot,
  RelatedPageLinks: true,
  ElButton: {
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
  ElTabs: {
    props: ['modelValue'],
    template: '<div class="tabs" :data-active="modelValue"><slot /></div>',
  },
  ElTabPane: tabPane,
  OperationAuditList: { template: '<div class="op-audit" />' },
  AuditList: { template: '<div class="file-audit" />' },
  JobMonitoringPolicies: { template: '<div class="job-monitoring" />' },
  AssetFreshnessPolicies: { template: '<div class="freshness" />' },
  UsageSummary: { template: '<div class="usage-summary" />' },
  CapacityProfile: { template: '<div class="capacity-profile" />' },
  ShardCatalogList: { template: '<div class="shard-catalog" />' },
  TenantPlacementList: { template: '<div class="tenant-placements" />' },
}

describe('IA 批次 2 合并页签中心与四角色可见性', () => {
  beforeEach(() => {
    state.query = {}
    state.push.mockReset()
    state.replace.mockReset()
    state.permissions = new Set()
    state.minRoles = new Set()
    state.allowedPaths = new Set()
  })

  it('审计页默认打开操作审计，支持 ?tab=file 并在页头提供执行日志跳转', async () => {
    state.allowedPaths = new Set(['/observability/queries', '/observability/usage'])
    const wrapper = mount(AuditCenter, { global: { stubs: commonStubs } })
    expect(wrapper.get('.tabs').attributes('data-active')).toBe('operation')
    expect(wrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'operation',
      'file',
    ])

    const logsBtn = wrapper.findAll('button').find((b) => b.text() === 'page.logs.title')!
    await logsBtn.trigger('click')
    expect(state.push).toHaveBeenCalledWith({
      path: '/observability/queries',
      query: { tab: 'executionLogs' },
    })

    state.query = { tab: 'file' }
    const fileWrapper = mount(AuditCenter, { global: { stubs: commonStubs } })
    expect(fileWrapper.get('.tabs').attributes('data-active')).toBe('file')
  })

  it('告警策略页签按原权限过滤：管理员看全部，仅 OPERATOR 看资产新鲜度', () => {
    state.permissions = new Set(['ROLE_TENANT_ADMIN'])
    state.minRoles = new Set(['OPERATOR'])
    const adminWrapper = mount(AlertPolicyCenter, { global: { stubs: commonStubs } })
    expect(adminWrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'job-monitoring',
      'freshness',
    ])

    state.permissions = new Set()
    state.minRoles = new Set(['OPERATOR'])
    const opOnlyWrapper = mount(AlertPolicyCenter, { global: { stubs: commonStubs } })
    expect(opOnlyWrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'freshness',
    ])
    expect(opOnlyWrapper.get('.tabs').attributes('data-active')).toBe('freshness')
  })

  it('使用统计与容量画像按四角色过滤：租户用户仅见容量画像，管理员/审计员见两页签', () => {
    state.permissions = new Set(['ROLE_AUDITOR'])
    state.minRoles = new Set(['VIEWER'])
    const auditorWrapper = mount(UsageAnalyticsCenter, { global: { stubs: commonStubs } })
    expect(auditorWrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'usage',
      'capacity',
    ])

    state.permissions = new Set(['ROLE_TENANT_USER'])
    state.minRoles = new Set(['VIEWER'])
    state.query = { tab: 'usage' }
    const tenantUserWrapper = mount(UsageAnalyticsCenter, { global: { stubs: commonStubs } })
    expect(tenantUserWrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'capacity',
    ])
    expect(tenantUserWrapper.get('.tabs').attributes('data-active')).toBe('capacity')
  })

  it('分片管理中心合并分片目录与租户分片并支持 ?tab=placements', async () => {
    state.query = { tab: 'placements' }
    const wrapper = mount(ShardManagementCenter, { global: { stubs: commonStubs } })
    await flushPromises()
    expect(wrapper.findAll('.tab-pane').map((el) => el.attributes('data-tab'))).toEqual([
      'catalog',
      'placements',
    ])
    expect(wrapper.get('.tabs').attributes('data-active')).toBe('placements')
  })
})
