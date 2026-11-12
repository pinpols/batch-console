// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import MApprovals from './MApprovals.vue'

const mocks = vi.hoisted(() => ({
  route: null as unknown as { query: Record<string, string> },
  replace: vi.fn(),
  query: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ userInfo: { username: 'operator-a' } }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: computed(() => true) }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({
    writesFrozen: computed(() => false),
    ensureWriteAvailable: () => true,
  }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/approvals', () => ({
  queryApprovalsPage: mocks.query,
  approveOne: vi.fn(),
  rejectOne: vi.fn(),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

enableAutoUnmount(afterEach)

function render() {
  return shallowMount(MApprovals, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
        ElSegmented: {
          name: 'ElSegmented',
          props: ['modelValue', 'options'],
          emits: ['update:modelValue', 'change'],
          template: '<div class="segment-stub" :data-value="modelValue" />',
        },
      },
    },
  })
}

beforeEach(() => {
  mocks.route = reactive({ query: {} })
  mocks.replace.mockReset()
  mocks.query.mockReset().mockResolvedValue({ items: [], total: 0 })
})

describe('移动审批中心分段', () => {
  it('默认显示普通审批', async () => {
    const wrapper = render()
    await flushPromises()

    expect(wrapper.get('.segment-stub').attributes('data-value')).toBe('general')
    expect(wrapper.findComponent({ name: 'MCatchUpPanel' }).exists()).toBe(false)
    expect(wrapper.find('.m-tabs').exists()).toBe(true)
  })

  it('tab=catch-up 深链直接显示补跑审批，不显示普通审批状态页签', async () => {
    mocks.route.query = { tab: 'catch-up' }
    const wrapper = render()
    await flushPromises()

    expect(wrapper.get('.segment-stub').attributes('data-value')).toBe('catch-up')
    expect(wrapper.findComponent({ name: 'MCatchUpPanel' }).exists()).toBe(true)
    expect(wrapper.find('.m-tabs').exists()).toBe(false)
  })

  it('切换分段时把 tab 写回地址，保留其他参数', async () => {
    mocks.route.query = { from: 'push' }
    const wrapper = render()
    await flushPromises()

    wrapper.findComponent({ name: 'ElSegmented' }).vm.$emit('update:modelValue', 'catch-up')
    await flushPromises()

    expect(mocks.replace).toHaveBeenCalledWith({ query: { from: 'push', tab: 'catch-up' } })
  })
})
