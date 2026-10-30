import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  batchDayReplayApi,
  type BatchDayReplayPreview,
  type ReplayOperation,
} from './batchDayReplay'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

import { get, post } from './client'

const mockedGet = vi.mocked(get)
const mockedPost = vi.mocked(post)

describe('batchDayReplayApi', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedPost.mockReset()
  })

  it('returns preview payload already unwrapped by the shared API client', async () => {
    const preview: BatchDayReplayPreview = {
      tenantId: 'system',
      calendarCode: 'default',
      bizDate: '2026-10-10',
      scope: 'ALL',
      executionMode: 'REPLAY',
      candidateSource: 'EXISTING_INSTANCES',
      resultPolicy: 'CREATE_NEW_VERSION',
      configVersionPolicy: 'USE_ORIGINAL_CONFIG',
      previewToken: 'preview-token',
      expiresAt: '2026-10-10T05:31:16Z',
      totalCount: 0,
      entries: [],
      resultVersionImpacts: [],
      assetPartitionImpacts: [],
      dispatchImpacts: [],
      warnings: ['NO_CANDIDATES'],
    }
    mockedPost.mockResolvedValue(preview)

    await expect(
      batchDayReplayApi.preview({
        tenantId: 'system',
        calendarCode: 'default',
        bizDate: '2026-10-10',
        scope: 'ALL',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        reason: 'integration preview',
        requestedBy: 'admin',
      }),
    ).resolves.toEqual(preview)
  })

  it('still unwraps a nested envelope when one is returned', async () => {
    const preview: BatchDayReplayPreview = {
      tenantId: 'system',
      calendarCode: 'default',
      bizDate: '2026-10-10',
      scope: 'ALL',
      executionMode: 'REPLAY',
      candidateSource: 'EXISTING_INSTANCES',
      resultPolicy: 'CREATE_NEW_VERSION',
      configVersionPolicy: 'USE_ORIGINAL_CONFIG',
      previewToken: 'preview-token',
      expiresAt: '2026-10-10T05:31:16Z',
      totalCount: 0,
      entries: [],
      resultVersionImpacts: [],
      assetPartitionImpacts: [],
      dispatchImpacts: [],
      warnings: [],
    }
    mockedPost.mockResolvedValue({ code: 'SUCCESS', data: preview, message: 'success' })

    await expect(
      batchDayReplayApi.preview({
        tenantId: 'system',
        calendarCode: 'default',
        bizDate: '2026-10-10',
        scope: 'ALL',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        reason: 'integration preview',
        requestedBy: 'admin',
      }),
    ).resolves.toEqual(preview)
  })

  it('loads persisted replay operations for the selected tenant', async () => {
    const operation = {
      id: 17,
      tenantId: 'tenant-a',
      operationKey: 'operation-key',
      operationType: 'BATCH_DAY_RANGE',
      status: 'RUNNING',
      totalCount: 3,
      succeededCount: 1,
      failedCount: 0,
      inFlightCount: 2,
    } as ReplayOperation
    mockedGet.mockResolvedValue({ code: 'SUCCESS', data: [operation], message: 'success' })

    await expect(batchDayReplayApi.operations({ tenantId: 'tenant-a', limit: 25 }))
      .resolves.toEqual([operation])
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/ops/batch-day-replay/operations',
      { tenantId: 'tenant-a', limit: 25 },
      expect.objectContaining({ _silent: true }),
    )
  })

  it('loads daily sessions for an operation with tenant scoping', async () => {
    const session = { id: 101, tenantId: 'tenant-a', replayOperationId: 17, bizDate: '2026-10-01' }
    mockedGet.mockResolvedValue({ code: 'SUCCESS', data: [session], message: 'success' })

    await expect(batchDayReplayApi.operationSessions(17, 'tenant-a')).resolves.toEqual([session])
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/ops/batch-day-replay/operations/17/sessions?tenantId=tenant-a',
    )
  })

  it('retries a failed submission with a reason and idempotency key', async () => {
    const session = { id: 101, tenantId: 'tenant-a', status: 'RUNNING' }
    mockedPost.mockResolvedValue(session)

    await expect(
      batchDayReplayApi.retryFailedSubmission(101, 77, 'tenant-a', 'confirmed no launch'),
    ).resolves.toEqual(session)

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/ops/batch-day-replay/sessions/101/entries/77/retry-submission?tenantId=tenant-a&reason=confirmed+no+launch',
      null,
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
  })

  it('reads result version governance data with tenant and business-key scope', async () => {
    const version = { id: 9, tenantId: 'tenant-a', businessKey: 'job:billing:2026-10-25' }
    mockedGet.mockResolvedValue({ code: 'SUCCESS', data: version, message: 'success' })

    await expect(
      batchDayReplayApi.effectiveResultVersion('tenant-a', 'job:billing:2026-10-25'),
    ).resolves.toEqual(version)
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/result-versions/effective',
      { tenantId: 'tenant-a', businessKey: 'job:billing:2026-10-25' },
      expect.objectContaining({ _silent: true }),
    )

    await expect(batchDayReplayApi.resultVersionDetail(9, 'tenant-a')).resolves.toEqual(version)
    expect(mockedGet).toHaveBeenLastCalledWith('/api/console/result-versions/9?tenantId=tenant-a')
  })

  it('sends idempotency keys for result version governance actions', async () => {
    const version = { id: 9, status: 'EFFECTIVE' }
    mockedPost.mockResolvedValue({ code: 'SUCCESS', data: version, message: 'success' })

    await expect(batchDayReplayApi.promoteResultVersion(9, 'tenant-a')).resolves.toEqual(version)
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/console/result-versions/9/promote?tenantId=tenant-a',
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }),
    )

    await expect(batchDayReplayApi.rejectResultVersion(9, 'tenant-a')).resolves.toEqual(version)
    expect(mockedPost).toHaveBeenLastCalledWith(
      '/api/console/result-versions/9/reject?tenantId=tenant-a',
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }),
    )
  })

  it('treats a successful null effective version as an empty state', async () => {
    mockedGet.mockResolvedValue({ code: 'SUCCESS', data: null, message: 'success' })

    await expect(
      batchDayReplayApi.effectiveResultVersion('tenant-a', 'job:billing:2026-10-25'),
    ).resolves.toBeNull()
  })
})
