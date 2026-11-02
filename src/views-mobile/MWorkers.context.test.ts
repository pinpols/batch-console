// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import MWorkers from './MWorkers.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  access: null as unknown as { allowed: boolean; frozen: boolean },
  auth: null as unknown as { userInfo: { username: string } },
  query: vi.fn(),
  confirm: vi.fn(),
  drain: vi.fn(),
  takeover: vi.fn(),
  warmup: vi.fn(),
  offline: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canMutateConfig: computed(() => mocks.access.allowed && !mocks.access.frozen),
  }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ ensureWriteAvailable: () => !mocks.access.frozen }),
}))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/layout-mobile/MActionSheet', () => ({ confirmActionSheet: mocks.confirm }))
vi.mock('@/api/workers', () => ({
  queryWorkers: mocks.query,
  drainWorker: mocks.drain,
  forceWorkerOffline: mocks.offline,
  takeoverWorker: mocks.takeover,
  warmupWorker: mocks.warmup,
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.access = reactive({ allowed: true, frozen: false })
  mocks.auth = reactive({ userInfo: { username: 'operator-a' } })
  mocks.query.mockReset().mockResolvedValue([
    { workerCode: 'online', status: 'ONLINE' },
    { workerCode: 'offline', status: 'OFFLINE' },
    { workerCode: 'retired', status: 'DECOMMISSIONED' },
  ])
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.drain.mockReset().mockResolvedValue(undefined)
  mocks.takeover.mockReset().mockResolvedValue(undefined)
  mocks.warmup.mockReset().mockResolvedValue(undefined)
  mocks.offline.mockReset().mockResolvedValue(undefined)
})

function render() {
  return shallowMount(MWorkers, {
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

describe('移动 Worker 操作', () => {
  it('列表加载失败提示重试，不显示空列表或零统计', async () => {
    mocks.query.mockRejectedValueOnce(new Error('network error'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile.common.loadFail')
    expect(wrapper.text()).not.toContain('mobile.workers.empty')
    expect(wrapper.find('.m-page__subtitle').exists()).toBe(false)
    await wrapper.get('.m-load-error button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('online')
  })

  it('刷新失败标记已有数据过期并禁用操作', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.query.mockRejectedValueOnce(new Error('network error'))
    await wrapper.get('.refresh').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('online')
    expect(wrapper.text()).toContain('mobile.workers.stale')
    expect(wrapper.get('[data-track="workers.drain"]').attributes('disabled')).toBeDefined()
  })

  it('按工作节点状态展示受支持的操作', async () => {
    const wrapper = render()
    await flushPromises()
    const cards = wrapper.findAll('.m-card')
    expect(cards[0].find('[data-track="workers.takeover"]').exists()).toBe(true)
    expect(cards[0].find('[data-track="workers.warmup"]').exists()).toBe(false)
    expect(cards[1].find('[data-track="workers.warmup"]').exists()).toBe(true)
    expect(cards[1].find('[data-track="workers.takeover"]').exists()).toBe(false)
    expect(cards[2].findAll('[data-track^="workers."]')).toHaveLength(0)
  })

  it('无写权限或维护冻结时不能执行节点操作', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.access.allowed = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-track="workers.drain"]').attributes('disabled')).toBeDefined()
    mocks.access.allowed = true
    mocks.access.frozen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-track="workers.drain"]').attributes('disabled')).toBeDefined()
    expect(mocks.drain).not.toHaveBeenCalled()
  })

  it('确认期间切换租户后不会向新租户提交旧节点操作', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-track="workers.drain"]').trigger('click')
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    confirm()
    await flushPromises()
    expect(mocks.drain).not.toHaveBeenCalled()
  })

  it('确认期间进入维护冻结后不执行节点操作', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-track="workers.drain"]').trigger('click')
    mocks.access.frozen = true
    confirm()
    await flushPromises()
    expect(mocks.drain).not.toHaveBeenCalled()
  })

  it('租户切换后迟到的节点列表不覆盖当前租户', async () => {
    let finishOld!: (workers: { workerCode: string; status: string }[]) => void
    mocks.query.mockImplementation((tenantId) =>
      tenantId === 'tenant-a'
        ? new Promise((resolve) => {
            finishOld = resolve
          })
        : Promise.resolve([{ workerCode: 'current', status: 'ONLINE' }]),
    )
    const wrapper = render()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld([{ workerCode: 'old', status: 'ONLINE' }])
    await flushPromises()
    expect(wrapper.text()).toContain('current')
    expect(wrapper.text()).not.toContain('old')
  })

  it('接管需要确认且将当前租户作为操作目标', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-track="workers.takeover"]').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(mocks.takeover).toHaveBeenCalledWith(
      'online',
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
  })
})
