import { describe, expect, it } from 'vitest'
import type { ConsoleFileArrivalGroupResponse } from '@/types/console-api'
import { summarizeArrivalGroups } from './arrivalGroupPresentation'

function group(
  overrides: Partial<ConsoleFileArrivalGroupResponse>,
): ConsoleFileArrivalGroupResponse {
  return {
    tenantId: 'ta',
    fileGroupCode: 'g1',
    waitFileGroupMode: 'ALL',
    requiredFileSet: 'a,b',
    arrivalTimeoutAction: 'ALERT',
    arrivalState: 'WAITING',
    expectedArrivalTime: '2026-09-21T00:00:00Z',
    latestTolerableTime: '2026-09-21T01:00:00Z',
    arrivedCount: 0,
    triggeredCount: 0,
    timeoutCount: 0,
    waitingCount: 0,
    lastUpdatedAt: '2026-09-21T00:00:00Z',
    ...overrides,
  }
}

describe('summarizeArrivalGroups', () => {
  it('summarizes group states and file-level progress', () => {
    expect(
      summarizeArrivalGroups([
        group({ arrivalState: 'COMPLETE', arrivedCount: 4 }),
        group({ arrivalState: 'PARTIAL', arrivedCount: 2, waitingCount: 2 }),
        group({ arrivalState: 'TIMEOUT', timeoutCount: 1 }),
      ]),
    ).toEqual({
      totalGroups: 3,
      readyGroups: 1,
      waitingGroups: 1,
      timeoutGroups: 1,
      arrivedFiles: 6,
      waitingFiles: 2,
      timeoutFiles: 1,
      triggeredFiles: 0,
      progress: 67,
    })
  })
})
