import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./client', () => ({ get: vi.fn(), post: vi.fn() }))
import { get, post } from './client'
import { listTerminalDeliveries, retryTerminalDelivery } from './terminalNotifications'

describe('terminal notification recovery API', () => {
  it('uses the Push delivery identity for an original-device retry', async () => {
    const evidence = { requestId: '00000000-0000-4000-8000-000000000002', expectedAttempt: 1,
      reason: 'provider checked', reconciliationReference: 'push-ticket', confirmedNotDelivered: true as const }
    await retryTerminalDelivery('ta', 'PUSH', 19, evidence)
    expect(post).toHaveBeenCalledWith('/api/console/notifications/terminal-deliveries/PUSH/19/retry', evidence, { params: { tenantId: 'ta' } })
  })
  beforeEach(() => { vi.mocked(get).mockReset(); vi.mocked(post).mockReset() })
  it('reads the tenant scoped recovery metadata', async () => {
    vi.mocked(get).mockResolvedValue([])
    await expect(listTerminalDeliveries('ta')).resolves.toEqual([])
    expect(get).toHaveBeenCalledWith('/api/console/notifications/terminal-deliveries', { tenantId: 'ta', limit: 100 })
  })
  it('keeps the frozen target, request identity and reconciliation evidence', async () => {
    const evidence = { requestId: '00000000-0000-4000-8000-000000000001', expectedAttempt: 3,
      reason: 'checked receiver', reconciliationReference: 'ticket-123', confirmedNotDelivered: true as const }
    await retryTerminalDelivery('ta', 'RULE', 17, evidence)
    expect(post).toHaveBeenCalledWith('/api/console/notifications/terminal-deliveries/RULE/17/retry', evidence, { params: { tenantId: 'ta' } })
  })
})
