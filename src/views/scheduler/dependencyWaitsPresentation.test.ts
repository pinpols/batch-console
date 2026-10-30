import { describe, expect, it } from 'vitest'
import type { CalendarDependencyWait } from '@/api/dependencyWaits'
import {
  canRequestCalendarDependencyAction,
  dependencySnapshotText,
  waitStatusTone,
} from './dependencyWaitsPresentation'

const calendarWait = (overrides: Partial<CalendarDependencyWait> = {}): CalendarDependencyWait => ({
  id: 1,
  tenantId: 'tenant-a',
  calendarCode: 'PAYMENTS',
  bizDate: '2026-10-25',
  waitStatus: 'WAITING',
  firstWaitingAt: '2026-10-25T00:00:00Z',
  lastCheckedAt: '2026-10-25T00:01:00Z',
  attemptCount: 1,
  ...overrides,
})

describe('dependency wait presentation', () => {
  it('allows only administrators to request an action for an unresolved wait', () => {
    expect(canRequestCalendarDependencyAction(calendarWait(), true)).toBe(true)
    expect(canRequestCalendarDependencyAction(calendarWait(), false)).toBe(false)
    expect(canRequestCalendarDependencyAction(calendarWait({ manualAction: 'RELEASE' }), true)).toBe(
      false,
    )
    expect(canRequestCalendarDependencyAction(calendarWait({ waitStatus: 'OPENED' }), true)).toBe(
      false,
    )
  })

  it('renders JSON dependency lists as plain text and preserves opaque snapshots', () => {
    expect(dependencySnapshotText('["UPSTREAM_A","UPSTREAM_B"]')).toBe('UPSTREAM_A, UPSTREAM_B')
    expect(dependencySnapshotText('{opaque snapshot')).toBe('{opaque snapshot')
    expect(dependencySnapshotText(null)).toBe('—')
  })

  it('uses distinct tones for waiting and completed decisions', () => {
    expect(waitStatusTone('WAITING')).toBe('warning')
    expect(waitStatusTone('OPENED')).toBe('success')
    expect(waitStatusTone('SKIPPED')).toBe('info')
  })
})
