// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import MCatchUp from './MCatchUp.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  auth: null as unknown as { canAccess: () => boolean; userInfo: { username: string } },
  maintenance: null as unknown as { frozen: boolean },
  query: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  success: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({
    writesFrozen: computed(() => mocks.maintenance.frozen),
    ensureWriteAvailable: () => !mocks.maintenance.frozen,
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/adapters', () => ({ fetchAllPageItems: mocks.query }))
vi.mock('@/api/approvals', () => ({ approveOne: mocks.approve, rejectOne: mocks.reject }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn(), success: mocks.success, warning: vi.fn() },
}))

enableAutoUnmount(afterEach)
const row = {
  id: 1,
  requestId: 'request-a',
  workflowCode: 'workflow-a',
  bizDate: '2026-11-02',
  requestStatus: 'ACCEPTED',
  approvalNo: 'approval-a',
  approvalStatus: 'PENDING',
}
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.auth = reactive({ canAccess: () => true, userInfo: { username: 'operator-a' } })
  mocks.maintenance = reactive({ frozen: false })
  mocks.query.mockReset().mockResolvedValue([row])
  mocks.approve.mockReset().mockResolvedValue(undefined)
  mocks.reject.mockReset().mockResolvedValue(undefined)
  mocks.success.mockReset()
})
function render() {
  return shallowMount(MCatchUp, {
    global: {
      stubs: {
        MPullRefresh: {
          props: ['onRefresh'],
          template:
            '<div><button class="refresh" @click="onRefresh">refresh</button><slot /></div>',
        },
      },
    },
  })
}

describe('移动补跑审批上下文', () => {
  it('查询失败显示错误和重试，不伪装成无审批', async () => {
    mocks.query.mockRejectedValueOnce(new Error('network error'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.catchup.empty')
    expect(wrapper.find('.m-page__subtitle').exists()).toBe(false)
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('request-a')
  })

  it('刷新失败时标示已有审批可能过期并禁用操作', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.query.mockRejectedValueOnce(new Error('network error'))
    await wrapper.get('.refresh').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('request-a')
    expect(wrapper.text()).toContain('mobile.catchup.stale')
    expect(wrapper.get('.m-card__actions button').attributes('disabled')).toBeDefined()
  })

  it('切换租户立即清除旧审批并忽略迟到的列表响应', async () => {
    let finishOld!: (rows: (typeof row)[]) => void
    mocks.query.mockImplementation((_url, params) =>
      params.tenantId === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve([{ ...row, requestId: 'request-b', approvalNo: 'approval-b' }]),
    )
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld([row])
    await flushPromises()
    expect(wrapper.text()).toContain('request-b')
    expect(wrapper.text()).not.toContain('request-a')
  })

  it('维护期间不允许提交审批', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.maintenance.frozen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.m-card__actions button').attributes('disabled')).toBeDefined()
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it('审批发出后切换租户，不显示旧操作结果或刷新新租户', async () => {
    let finish!: () => void
    mocks.approve.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('.m-card__actions button').trigger('click')
    expect(mocks.approve).toHaveBeenCalledWith(
      'approval-a',
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    const callsAfterSwitch = mocks.query.mock.calls.length
    finish()
    await flushPromises()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.query).toHaveBeenCalledTimes(callsAfterSwitch)
  })
})
