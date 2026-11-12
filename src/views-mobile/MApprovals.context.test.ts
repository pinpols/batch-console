// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import MApprovals from './MApprovals.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  access: null as unknown as { allowed: boolean; frozen: boolean },
  auth: null as unknown as { userInfo: { username: string } },
  query: vi.fn(),
  confirm: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canMutateConfig: computed(() => mocks.access.allowed && !mocks.access.frozen),
  }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({
    writesFrozen: computed(() => mocks.access.frozen),
    ensureWriteAvailable: () => !mocks.access.frozen,
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.query,
  approveOne: mocks.approve,
  rejectOne: mocks.reject,
}))
vi.mock('@/layout-mobile/MActionSheet', () => ({ confirmActionSheet: mocks.confirm }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

enableAutoUnmount(afterEach)
const approval = { approvalNo: 'approval-a', approvalStatus: 'PENDING', approvalType: 'TEST' }
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.auth = reactive({ userInfo: { username: 'operator-a' } })
  mocks.access = reactive({ allowed: true, frozen: false })
  mocks.query
    .mockReset()
    .mockImplementation((_tenant, _page, size) =>
      Promise.resolve({ items: size === 1 ? [] : [approval], total: 1 }),
    )
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.approve.mockReset().mockResolvedValue(undefined)
  mocks.reject.mockReset().mockResolvedValue(undefined)
})
function render() {
  return shallowMount(MApprovals, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('移动审批列表上下文', () => {
  it('首屏失败提供重试，不显示无审批', async () => {
    mocks.query.mockRejectedValueOnce(new Error('network error'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.approvals.noPending')
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('approval-a')
  })

  it('切换租户后迟到的旧列表不能覆盖当前租户', async () => {
    let finishOld!: (value: { items: (typeof approval)[]; total: number }) => void
    mocks.query.mockImplementation((tenant, _page, size) => {
      if (tenant === 'tenant-a' && size !== 1)
        return new Promise((resolve) => {
          finishOld = resolve
        })
      return Promise.resolve({
        items: size === 1 ? [] : [{ ...approval, approvalNo: 'approval-b' }],
        total: 1,
      })
    })
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld({ items: [approval], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('approval-b')
    expect(wrapper.text()).not.toContain('approval-a')
  })

  it('拒绝确认期间切换租户不会向新租户提交旧审批', async () => {
    let finish!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-track="approvals.reject"]').trigger('click')
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finish()
    await flushPromises()
    expect(mocks.reject).not.toHaveBeenCalled()
  })

  it('切换筛选后迟到的旧列表不会覆盖当前列表', async () => {
    let finishOld!: (value: { items: (typeof approval)[]; total: number }) => void
    mocks.query.mockImplementation((_tenant, _page, size, filters) => {
      if (size === 1) return Promise.resolve({ items: [], total: 1 })
      if (filters?.approvalStatus === 'PENDING')
        return new Promise((resolve) => {
          finishOld = resolve
        })
      return Promise.resolve({
        items: [{ ...approval, approvalNo: 'approval-b', approvalStatus: 'REJECTED' }],
        total: 1,
      })
    })
    const wrapper = render()
    await wrapper.findAll('[role="tab"]')[2].trigger('click')
    await flushPromises()
    finishOld({ items: [approval], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('approval-b')
    expect(wrapper.text()).not.toContain('approval-a')
  })

  it('确认期间切换筛选再切回，旧确认不能继续提交', async () => {
    let finish!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-track="approvals.reject"]').trigger('click')
    await wrapper.findAll('[role="tab"]')[2].trigger('click')
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[0].trigger('click')
    await flushPromises()
    finish()
    await flushPromises()
    expect(mocks.reject).not.toHaveBeenCalled()
  })

  it('无权限时审批按钮禁用', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.access.allowed = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-track="approvals.approve"]').attributes('disabled')).toBeDefined()
  })

  it('已拒绝筛选为空时不显示“无待审批”', async () => {
    mocks.query.mockResolvedValue({ items: [], total: 0 })
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('[role="tab"]')[2].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.approvals.noMatched')
    expect(wrapper.text()).not.toContain('mobile.approvals.noPending')
  })

  it('计数请求失败时保留审批列表并提示计数不可用', async () => {
    mocks.query.mockImplementation((_tenant, _page, size) =>
      size === 1
        ? Promise.reject(new Error('count unavailable'))
        : Promise.resolve({ items: [approval], total: 1 }),
    )
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('approval-a')
    expect(wrapper.text()).toContain('mobile.approvals.countsUnavailable')
  })
})
