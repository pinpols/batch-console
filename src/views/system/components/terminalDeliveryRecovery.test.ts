import { describe, expect, it } from 'vitest'
import { canRetryTerminalDelivery, terminalDeliveryStatusKey } from './terminalDeliveryRecovery'
import type { TerminalDelivery } from '@/api/terminalNotifications'

const failed: TerminalDelivery = { source: 'RULE', id: 17, terminalEventKey: 'ta:workflow:3:terminal',
  eventType: 'WORKFLOW_FAILED', deliveryStatus: 'EXHAUSTED', attempt: 1, createdAt: '2026-10-20T00:00:00Z' }

describe('terminal delivery recovery eligibility', () => {
  it('supports manual Push recovery while keeping provider acceptance distinct from read delivery', () => {
    const push = { ...failed, source: 'PUSH' as const, terminalEventKey: 'ta:job:3:terminal:FAILED' }
    expect(canRetryTerminalDelivery(push)).toBe(true)
    expect(terminalDeliveryStatusKey({ ...push, deliveryStatus: 'ACCEPTED' })).toBe('terminalNotifications.providerAccepted')
    expect(canRetryTerminalDelivery({ ...push, deliveryStatus: 'ACCEPTED' })).toBe(false)
    expect(canRetryTerminalDelivery({ ...push, deliveryStatus: 'GONE' })).toBe(false)
  })
  it('never treats an intake decision as an exhausted device delivery', () => {
    for (const status of ['DISABLED', 'DRY_RUN', 'NO_OPERATOR', 'NO_SUBSCRIPTIONS', 'QUEUED']) {
      const decision = { ...failed, source: 'PUSH' as const, deliveryStatus: status, attempt: 0 }
      expect(canRetryTerminalDelivery(decision)).toBe(false)
      expect(terminalDeliveryStatusKey(decision)).toMatch(/^terminalNotifications\./)
    }
  })
  it('preserves generic status display for non-Push or unknown statuses', () => {
    expect(terminalDeliveryStatusKey(failed)).toBeUndefined()
    expect(terminalDeliveryStatusKey({ ...failed, source: 'PUSH', deliveryStatus: 'FUTURE' })).toBeUndefined()
  })
  it('allows an exhausted delivery only after its claim expires', () => {
    expect(canRetryTerminalDelivery(failed)).toBe(true)
    expect(canRetryTerminalDelivery({ ...failed, claimUntil: '2026-10-20T00:00:02Z' }, Date.parse('2026-10-20T00:00:01Z'))).toBe(false)
    expect(canRetryTerminalDelivery({ ...failed, claimUntil: '2026-10-20T00:00:02Z' }, Date.parse('2026-10-20T00:00:02Z'))).toBe(true)
  })
  it('blocks successful, pending, automatically retrying and never attempted deliveries', () => {
    for (const row of [{ ...failed, deliveryStatus: 'SUCCESS' }, { ...failed, deliveryStatus: 'PENDING' },
      { ...failed, nextRetryAt: '2026-10-20T00:00:00Z' }, { ...failed, attempt: 0 }]) {
      expect(canRetryTerminalDelivery(row)).toBe(false)
    }
  })
})
