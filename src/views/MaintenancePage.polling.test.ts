// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import MaintenancePage from './MaintenancePage.vue'

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  replace: vi.fn(),
  app: null as unknown as {
    maintenance: {
      enabled: boolean
      active: boolean
      message: string | null
      etaAt: string | null
      affectedServices: string[]
      lastSyncedAt: string | null
    }
    setMaintenance: (update: object) => void
  },
}))
vi.mock('@/api/system.maintenance', () => ({ getMaintenanceStatus: mocks.getStatus }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.app }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => false }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useRoute: () => ({ query: { redirect: '/runs' } }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('维护页面恢复检查', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.replace.mockReset()
    mocks.getStatus.mockReset()
    mocks.app = reactive({
      maintenance: {
        enabled: true,
        active: true,
        message: null,
        etaAt: null,
        affectedServices: [],
        lastSyncedAt: null,
      },
      setMaintenance(update: object) {
        Object.assign(this.maintenance, update)
      },
    })
  })
  afterEach(() => vi.useRealTimers())

  it('自动轮询，恢复后返回原页面，卸载后停止', async () => {
    mocks.getStatus
      .mockResolvedValueOnce({ enabled: true, active: true, affectedServices: [] })
      .mockResolvedValueOnce({ enabled: false, active: false, affectedServices: [] })
    const wrapper = mount(MaintenancePage, { global: { stubs: { ElIcon: true, ElButton: true } } })
    await flushPromises()
    expect(mocks.getStatus).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(mocks.getStatus).toHaveBeenCalledTimes(2)
    expect(mocks.replace).toHaveBeenCalledWith('/runs')
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.getStatus).toHaveBeenCalledTimes(2)
  })
})
