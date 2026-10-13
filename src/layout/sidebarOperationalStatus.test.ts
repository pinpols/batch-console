import { describe, expect, it } from 'vitest'
import {
  resolveSidebarOperationalStatus,
  type SidebarMaintenanceState,
} from './sidebarOperationalStatus'

const syncedAndDisabled: SidebarMaintenanceState = {
  enabled: false,
  active: false,
  readOnly: false,
  adminBypass: false,
  lastSyncedAt: '2026-10-13T10:00:00Z',
  syncError: null,
  isStale: false,
}

describe('resolveSidebarOperationalStatus', () => {
  it('keeps status unknown until maintenance state has synced', () => {
    expect(
      resolveSidebarOperationalStatus({ ...syncedAndDisabled, lastSyncedAt: null }, false).tone,
    ).toBe('unknown')
  })

  it('reports a normal maintenance state only after a successful fresh sync', () => {
    expect(resolveSidebarOperationalStatus(syncedAndDisabled, false).tone).toBe('normal')
    expect(
      resolveSidebarOperationalStatus({ ...syncedAndDisabled, isStale: true }, false).tone,
    ).toBe('unknown')
    expect(
      resolveSidebarOperationalStatus({ ...syncedAndDisabled, syncError: 'offline' }, false).tone,
    ).toBe('unknown')
  })

  it('distinguishes scheduled, read-only, full maintenance, admin diagnostics, and degradation', () => {
    expect(
      resolveSidebarOperationalStatus({ ...syncedAndDisabled, enabled: true }, false).tone,
    ).toBe('scheduled')
    expect(
      resolveSidebarOperationalStatus(
        { ...syncedAndDisabled, enabled: true, active: true, readOnly: true },
        false,
      ).tone,
    ).toBe('read-only')
    expect(
      resolveSidebarOperationalStatus({ ...syncedAndDisabled, enabled: true, active: true }, false)
        .tone,
    ).toBe('maintenance')
    expect(
      resolveSidebarOperationalStatus(
        { ...syncedAndDisabled, enabled: true, active: true, adminBypass: true },
        false,
      ).tone,
    ).toBe('admin-bypass')
    expect(resolveSidebarOperationalStatus(syncedAndDisabled, true).tone).toBe('degraded')
  })
})
