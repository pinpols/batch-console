import { describe, expect, it } from 'vitest'
import {
  canCancelInstance,
  canTerminateInstance,
  resolveInstanceCancelOutcome,
} from './instanceAction'

describe('instance lifecycle actions', () => {
  it('matches cancel and terminate actions to backend-supported states', () => {
    for (const status of ['CREATED', 'WAITING', 'READY', 'RUNNING']) {
      expect(canCancelInstance(status)).toBe(true)
    }
    expect(canCancelInstance('PAUSED')).toBe(false)
    expect(canCancelInstance('SUCCESS')).toBe(false)
    expect(canTerminateInstance('RUNNING')).toBe(true)
    expect(canTerminateInstance('PAUSED')).toBe(false)
  })
})

describe('resolveInstanceCancelOutcome', () => {
  it('distinguishes a running cancellation request from a completed cancellation', () => {
    expect(resolveInstanceCancelOutcome('CANCEL_REQUESTED')).toBe('requested')
    expect(resolveInstanceCancelOutcome('CANCELLED')).toBe('completed')
    expect(resolveInstanceCancelOutcome('CANCELED')).toBe('completed')
  })

  it('does not claim completion for an unexpected or future status', () => {
    expect(resolveInstanceCancelOutcome('WAITING')).toBe('accepted')
    expect(resolveInstanceCancelOutcome('')).toBe('accepted')
  })
})
