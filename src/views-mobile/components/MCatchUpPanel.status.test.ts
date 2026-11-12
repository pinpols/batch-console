// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import MCatchUpPanel from './MCatchUpPanel.vue'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ canAccess: () => true }) }))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: false, ensureWriteAvailable: () => true }),
}))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/adapters', () => ({ fetchAllPageItems: mocks.query }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, args?: { n?: number }) => (args?.n === undefined ? key : `${key}:${args.n}`),
    te: () => true,
  }),
}))

enableAutoUnmount(afterEach)
beforeEach(() =>
  mocks.query.mockReset().mockResolvedValue([
    {
      id: 1,
      requestId: 'pending',
      workflowCode: 'BILLING',
      bizDate: '2026-11-02',
      requestStatus: 'ACCEPTED',
      approvalNo: 'A-1',
      approvalStatus: 'PENDING',
    },
    {
      id: 2,
      requestId: 'legacy',
      workflowCode: 'BILLING',
      bizDate: '2026-11-02',
      requestStatus: 'ACCEPTED',
      approvalNo: null,
    },
    {
      id: 3,
      requestId: 'approved',
      workflowCode: 'BILLING',
      bizDate: '2026-11-02',
      requestStatus: 'ACCEPTED',
      approvalNo: 'A-3',
      approvalStatus: 'APPROVED',
    },
  ]),
)

describe('移动补跑审批状态', () => {
  it('按审批状态展示待审批数量和操作，并对旧记录显示只读原因', async () => {
    const wrapper = shallowMount(MCatchUpPanel)
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.catchup.pendingCount:1')
    const cards = wrapper.findAll('.m-card')
    expect(cards[0].text()).toContain('enum.approvalStatus.PENDING')
    expect(cards[0].findAll('.m-card__actions button')).toHaveLength(2)
    expect(cards[1].text()).toContain('mobile.catchup.legacyNoApprovalNo')
    expect(cards[1].find('.m-card__actions').exists()).toBe(false)
    expect(cards[2].text()).toContain('enum.approvalStatus.APPROVED')
    expect(cards[2].find('.m-card__actions').exists()).toBe(false)
  })
})
