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
  it('按租户和组编码统计组，并按实际记录状态汇总文件数', () => {
    expect(
      summarizeArrivalGroups([
        group({ arrivalState: 'WAITING_ARRIVAL', arrivedCount: 2, waitingCount: 2 }),
        group({ arrivalState: 'TRIGGERED', arrivedCount: 1, triggeredCount: 1 }),
        group({ fileGroupCode: 'g2', arrivalState: 'TIMEOUT', arrivedCount: 1, timeoutCount: 1 }),
        group({
          tenantId: 'tb',
          arrivalState: 'WAITING_ARRIVAL',
          arrivedCount: 1,
          waitingCount: 1,
        }),
        group({ fileGroupCode: 'g3', arrivalState: 'UNKNOWN', arrivedCount: 1 }),
      ]),
    ).toEqual({
      totalGroups: 4,
      readyGroups: 1,
      waitingGroups: 2,
      timeoutGroups: 1,
      arrivedFiles: 6,
      waitingFiles: 3,
      timeoutFiles: 1,
      triggeredFiles: 1,
    })
  })
})
