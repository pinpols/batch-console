import { describe, it, expect, vi, beforeEach } from 'vitest'
import { approveOne, rejectOne, batchApprove, batchReject, queryApprovals } from './approvals'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))
vi.mock('./adapters', () => ({
  fetchAllPageItems: vi.fn(),
}))

import { post } from './client'
import { fetchAllPageItems } from './adapters'

const mockedPost = vi.mocked(post)
const mockedAll = vi.mocked(fetchAllPageItems)

describe('approvalsApi', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedAll.mockReset()
  })

  it('queryApprovals aggregates pages by tenantId', async () => {
    mockedAll.mockResolvedValue([])
    await queryApprovals('ta')
    expect(mockedAll).toHaveBeenCalledWith('/api/console/queries/approvals', { tenantId: 'ta' })
  })

  it('approveOne POST with encoded approvalNo + body', async () => {
    mockedPost.mockResolvedValue('ok')
    await approveOne('APR-2025/01', { tenantId: 'ta', reason: 'looks good' })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/approvals/APR-2025%2F01/approve', {
      tenantId: 'ta',
      reason: 'looks good',
    })
  })

  it('rejectOne POST', async () => {
    mockedPost.mockResolvedValue('ok')
    await rejectOne('APR-1', { tenantId: 'ta', reason: 'no' })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/approvals/APR-1/reject', {
      tenantId: 'ta',
      reason: 'no',
    })
  })

  it('batchApprove POST with multiple approvalNos', async () => {
    mockedPost.mockResolvedValue([])
    const body = { tenantId: 'ta', approvalNos: ['A1', 'A2'], reason: 'bulk' }
    await batchApprove(body)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/approvals/batch-approve', body)
  })

  it('batchReject POST', async () => {
    mockedPost.mockResolvedValue([])
    const body = { tenantId: 'ta', approvalNos: ['A1'], operatorId: 'u1' }
    await batchReject(body)
    expect(mockedPost).toHaveBeenCalledWith('/api/console/approvals/batch-reject', body)
  })

  it('approveOne optional operatorId/reason omittable', async () => {
    mockedPost.mockResolvedValue('ok')
    await approveOne('A1', { tenantId: 'ta' })
    expect(mockedPost).toHaveBeenCalledWith('/api/console/approvals/A1/approve', { tenantId: 'ta' })
  })
})
