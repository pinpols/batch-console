import { describe, expect, it } from 'vitest'
import type { ConsoleJobInstanceResponse } from '@/types/console-api'
import { canSelectJobInstanceForBulk } from './jobInstanceBulk'

function instance(instanceStatus: string): ConsoleJobInstanceResponse {
  return { instanceStatus } as ConsoleJobInstanceResponse
}

describe('canSelectJobInstanceForBulk', () => {
  it.each(['CREATED', 'WAITING', 'RUNNING', 'RETRYING', 'FAILED'])(
    'allows actionable status %s',
    (status) => {
      expect(canSelectJobInstanceForBulk(instance(status))).toBe(true)
    },
  )

  it.each([
    'SUCCESS',
    'CANCELLED',
    'CANCELED',
    'TERMINATED',
    'PARTIAL_FAILED',
    'SUCCESS_DRY_RUN',
    'FAILED_DRY_RUN',
  ])('rejects terminal status %s with no bulk action', (status) => {
    expect(canSelectJobInstanceForBulk(instance(status))).toBe(false)
  })
})
