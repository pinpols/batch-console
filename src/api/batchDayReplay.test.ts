import { beforeEach, describe, expect, it, vi } from 'vitest'
import { batchDayReplayApi, type BatchDayReplayPreview } from './batchDayReplay'

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
    const preview = { totalCount: 0, entries: [] } as BatchDayReplayPreview
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
})
