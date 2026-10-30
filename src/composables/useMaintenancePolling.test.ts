// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMaintenancePolling } from './useMaintenancePolling'

const state = vi.hoisted(() => ({ getStatus: vi.fn(), setMaintenance: vi.fn() }))
vi.mock('@/api/system.maintenance', () => ({ getMaintenanceStatus: state.getStatus }))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ maintenance: {}, setMaintenance: state.setMaintenance }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => false }) }))

describe('maintenance polling lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['success', 'failure'])(
    'ignores a late %s after the polling owner unmounts',
    async (outcome) => {
      let resolve!: (value: unknown) => void
      let reject!: (error: Error) => void
      state.getStatus.mockReturnValueOnce(
        new Promise((res, rej) => {
          resolve = res
          reject = rej
        }),
      )
      const wrapper = mount({
        setup() {
          useMaintenancePolling()
          return () => null
        },
      })
      wrapper.unmount()
      if (outcome === 'success') resolve({ enabled: true, active: true, version: 2 })
      else reject(new Error('network unavailable'))
      await flushPromises()
      expect(state.setMaintenance).not.toHaveBeenCalled()
    },
  )
})
