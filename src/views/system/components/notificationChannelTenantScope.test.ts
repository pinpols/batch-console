import { describe, expect, it } from 'vitest'
import { createNotificationChannelRequestFence } from './notificationChannelTenantScope'

describe('notification channel tenant request fence', () => {
  it('rejects a late response after the selected tenant changes', () => {
    const fence = createNotificationChannelRequestFence()

    const tenantARequest = fence.begin('tenant-a')
    const tenantBRequest = fence.begin('tenant-b')

    expect(fence.isCurrent(tenantARequest, 'tenant-b')).toBe(false)
    expect(fence.isCurrent(tenantBRequest, 'tenant-b')).toBe(true)
  })

  it('rejects an older response for the same tenant after a refresh starts', () => {
    const fence = createNotificationChannelRequestFence()

    const firstRequest = fence.begin('tenant-a')
    const refreshRequest = fence.begin('tenant-a')

    expect(fence.isCurrent(firstRequest, 'tenant-a')).toBe(false)
    expect(fence.isCurrent(refreshRequest, 'tenant-a')).toBe(true)
  })

  it('invalidates in-flight responses when the tenant view is cleared', () => {
    const fence = createNotificationChannelRequestFence()
    const request = fence.begin('tenant-a')

    fence.invalidate()

    expect(fence.isCurrent(request, 'tenant-a')).toBe(false)
  })
})
