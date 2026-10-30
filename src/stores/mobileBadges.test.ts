import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from './tenant'
import { useMobileBadgesStore } from './mobileBadges'
import { stubLocalStorage } from '@/test-utils/localStorage'

const api = vi.hoisted(() => ({ summary: vi.fn() }))
vi.mock('@/api/ops', () => ({ getOpsSummary: api.summary }))
const storage = stubLocalStorage()

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  useTenantStore().setTenantId('tenant-a')
  api.summary.mockReset()
})

describe('桌面通知中心和移动端徽章租户隔离', () => {
  it('旧租户请求仍在途时立即读取新租户，并丢弃旧计数', async () => {
    let resolveA!: (value: unknown) => void
    api.summary
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveA = resolve
        }),
      )
      .mockResolvedValueOnce({
        pendingApprovals: 2,
        openAlerts: 3,
        criticalAlerts: 1,
        failedJobs: 4,
      })
    const badges = useMobileBadgesStore()
    const pending = badges.refresh()
    useTenantStore().setTenantId('tenant-b')
    await badges.refresh()
    resolveA({ pendingApprovals: 99, openAlerts: 98, criticalAlerts: 97, failedJobs: 96 })
    await pending
    expect(api.summary).toHaveBeenCalledTimes(2)
    expect(badges.pendingApprovals).toBe(2)
    expect(badges.openAlerts).toBe(3)
    expect(badges.criticalAlerts).toBe(1)
    expect(badges.failedJobs).toBe(4)
    badges.$dispose()
  })

  it('清空租户时同步清空计数，不保留前一个租户的待办', async () => {
    api.summary.mockResolvedValue({ pendingApprovals: 7, openAlerts: 8, criticalAlerts: 1 })
    const badges = useMobileBadgesStore()
    await badges.refresh()
    useTenantStore().setTenantId('')
    expect(badges.pendingApprovals).toBe(0)
    expect(badges.openAlerts).toBe(0)
    expect(badges.criticalAlerts).toBe(0)
    badges.$dispose()
  })

  it('同一租户刷新失败时保留最近成功计数，失败作业仍不计为待办徽章', async () => {
    api.summary
      .mockResolvedValueOnce({ pendingApprovals: 7, openAlerts: 8, failedJobs: 9 })
      .mockRejectedValueOnce(new Error('暂时不可用'))
    const badges = useMobileBadgesStore()
    await badges.refresh()
    await badges.refresh()
    expect(badges.pendingApprovals).toBe(7)
    expect(badges.openAlerts).toBe(8)
    expect(badges.jobsBadge).toBe(0)
    badges.$dispose()
  })
})
