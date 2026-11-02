import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryAuditsPage, replayDeadLetter } from './observabilityQueries'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

import { get, post } from './client'

const mockedPost = vi.mocked(post)

describe('queryAuditsPage 文件 ID', () => {
  it.each(['9223372036854775807', 'abc', 0])('将 %s 原样传到查询请求', async (fileId) => {
    vi.mocked(get).mockResolvedValue({ items: [], total: 0 })
    await queryAuditsPage('tenant-a', 1, 15, { fileId })
    expect(get).toHaveBeenLastCalledWith('/api/console/queries/audits', {
      tenantId: 'tenant-a',
      pageNo: 1,
      pageSize: 15,
      fileId,
    })
  })
})

describe('observabilityQueries replayDeadLetter', () => {
  beforeEach(() => mockedPost.mockReset())

  it('sends operator, reason, confirmation, and evidence for verified external outcomes', async () => {
    mockedPost.mockResolvedValue('approval-1')

    await replayDeadLetter(
      'tenant-a',
      42,
      'checked incident INC-12',
      {
        externalActionVerifiedNotExecuted: true,
        externalOutcomeEvidenceReference: 'incident://INC-12/evidence-1',
      },
      'operator-a',
    )

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
