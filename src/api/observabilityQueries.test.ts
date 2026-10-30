import { beforeEach, describe, expect, it, vi } from 'vitest'
import { replayDeadLetter } from './observabilityQueries'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

import { post } from './client'

const mockedPost = vi.mocked(post)

describe('observabilityQueries replayDeadLetter', () => {
  beforeEach(() => mockedPost.mockReset())

  it('sends operator, reason, confirmation, and evidence for verified external outcomes', async () => {
    mockedPost.mockResolvedValue('approval-1')

    await replayDeadLetter('tenant-a', 42, 'checked incident INC-12', {
      externalActionVerifiedNotExecuted: true,
      externalOutcomeEvidenceReference: 'incident://INC-12/evidence-1',
    }, 'operator-a')

    expect(mockedPost).toHaveBeenCalledWith('/api/console/jobs/dead-letters/replay', {
      tenantId: 'tenant-a',
      deadLetterId: 42,
      reason: 'checked incident INC-12',
      operatorId: 'operator-a',
      externalActionVerifiedNotExecuted: true,
      externalOutcomeEvidenceReference: 'incident://INC-12/evidence-1',
    })
  })

  it('preserves the ordinary replay request shape when no resolution is supplied', async () => {
    mockedPost.mockResolvedValue('approval-2')

    await replayDeadLetter('tenant-a', 43)

    expect(mockedPost).toHaveBeenCalledWith('/api/console/jobs/dead-letters/replay', {
      tenantId: 'tenant-a',
      deadLetterId: 43,
    })
  })
})
