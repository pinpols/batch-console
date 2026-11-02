// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import MAlerts from './MAlerts.vue'
import MApprovals from './MApprovals.vue'
import MWorkers from './MWorkers.vue'

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  alerts: vi.fn(),
  approvals: vi.fn(),
  workers: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { username: 'operator-a' } }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))
vi.mock('@/composables/useCopy', () => ({ useCopy: () => ({ copy: mocks.copy }) }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: computed(() => false) }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: false, ensureWriteAvailable: () => true }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/alertsQuery', () => ({ queryAlertsPage: mocks.alerts }))
vi.mock('@/api/alertsCommands', () => ({
  acknowledgeAlert: vi.fn(),
  silenceAlert: vi.fn(),
  closeAlert: vi.fn(),
}))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.approvals,
  approveOne: vi.fn(),
  rejectOne: vi.fn(),
}))
vi.mock('@/api/workers', () => ({
  queryWorkers: mocks.workers,
  drainWorker: vi.fn(),
  forceWorkerOffline: vi.fn(),
  takeoverWorker: vi.fn(),
  warmupWorker: vi.fn(),
}))
vi.mock('@/layout-mobile/MActionSheet', () => ({ confirmActionSheet: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.copy.mockReset()
  mocks.alerts.mockReset().mockResolvedValue({
    items: [{ id: 1, title: 'Alert', status: 'OPEN', traceId: 'trace-long-id' }],
    total: 1,
  })
  mocks.approvals.mockReset().mockResolvedValue({
    items: [{ approvalNo: 'approval-long-id', approvalStatus: 'PENDING', approvalType: 'TEST' }],
    total: 1,
  })
  mocks.workers.mockReset().mockResolvedValue([{ workerCode: 'worker-long-id', status: 'ONLINE' }])
})

describe('移动列表标识复制的键盘入口', () => {
  it.each([
    { component: MAlerts, value: 'trace-long-id', kind: 'traceId' },
    { component: MApprovals, value: 'approval-long-id', kind: 'approvalNo' },
    { component: MWorkers, value: 'worker-long-id', kind: 'workerCode' },
  ])('以具名原生按钮复制 $kind 的完整值', async ({ component, value, kind }) => {
    const navigate = vi.fn()
    const wrapper = shallowMount(component, {
      global: {
        mocks: { $router: { push: navigate } },
        stubs: { MPullRefresh: { template: '<div><slot /></div>' } },
      },
    })
    await flushPromises()
    const button = wrapper.get('.m-copy-text')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toContain(value)
    await button.trigger('click')
    expect(mocks.copy).toHaveBeenCalledExactlyOnceWith(value, kind)
    expect(navigate).not.toHaveBeenCalled()
  })
})
