import { describe, it, expect, vi, beforeEach } from 'vitest'
import { approveOne, rejectOne, batchApprove, batchReject, queryApprovalsPage } from './approvals'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))
import { get, post } from './client'

const mockedPost = vi.mocked(post)
const mockedGet = vi.mocked(get)

describe('approvalsApi', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
  })

  it('queryApprovalsPage sends generated query filters to server pagination', async () => {
    mockedGet.mockResolvedValue({ total: 0, pageNo: 1, pageSize: 15, items: [] })
    await queryApprovalsPage('ta', 1, 15, {
      approvalStatus: 'PENDING',
      keyword: 'job-a',
    })
    expect(mockedGet).toHaveBeenCalledWith('/api/console/queries/approvals', {
      tenantId: 'ta',
      pageNo: 1,
      pageSize: 15,
      approvalStatus: 'PENDING',
      keyword: 'job-a',
    })
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
