// @vitest-environment jsdom
import { effectScope, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useOnboardingChecklist } from './useOnboardingChecklist'

const state = vi.hoisted(() => ({
  tenant: { tenantId: '' } as { tenantId: string },
  evidence: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/ops/summary', fullPath: '/ops/summary', query: {} }),
}))
vi.mock('@/api/onboarding', () => ({ getOnboardingEvidence: state.evidence }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ userInfo: { userId: 'u1', permissions: ['ROLE_TENANT_USER'] } }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/utils/logger', () => ({ logClick: vi.fn(), logError: vi.fn() }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))

describe('useOnboardingChecklist', () => {
  it('选定租户后在证据加载完成前，“选择租户”一步已完成', async () => {
    state.tenant = reactive({ tenantId: '' })
    state.evidence.mockReturnValue(new Promise(() => {}))
    const scope = effectScope()
    const checklist = scope.run(() => useOnboardingChecklist())!
    const tenantStep = () => checklist.checklist.value.steps.find((s) => s.id === 'tenant-context')
    expect(tenantStep()?.status).not.toBe('completed')

    state.tenant.tenantId = 'ta'
    void checklist.load()
    expect(tenantStep()?.status).toBe('completed')
    scope.stop()
  })
})
