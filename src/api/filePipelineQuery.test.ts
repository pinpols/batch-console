import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/api/client', () => ({ get: vi.fn() }))
import { get } from '@/api/client'
import {
  queryFileDispatchPage,
  queryFileErrorPage,
  queryFilePipelinePage,
  queryFilePipelineStepPage,
  queryPipelineProgress,
} from './filePipelineQuery'

beforeEach(() => {
  vi.mocked(get).mockReset()
})

describe('filePipelineQuery', () => {
  it.each([
    ['/api/console/queries/file-pipelines', queryFilePipelinePage],
    ['/api/console/queries/file-pipeline-steps', queryFilePipelineStepPage],
    ['/api/console/queries/file-dispatches', queryFileDispatchPage],
    ['/api/console/queries/file-errors', queryFileErrorPage],
  ])('%s 传递租户、页码和关键字', async (path, query) => {
    const params = { tenantId: 'ta', pageNo: 2, pageSize: 15, keyword: 'failed' }
    vi.mocked(get).mockResolvedValue({ items: [], total: 0 })
    await query(params)
    expect(get).toHaveBeenCalledWith(path, params)
  })
})

describe('queryPipelineProgress', () => {
  it('queries by pipeline instance and preserves an empty snapshot', async () => {
    const response = { pipelineInstanceId: 42, steps: [] }
    vi.mocked(get).mockResolvedValue(response)
    expect(await queryPipelineProgress(42)).toEqual(response)
    expect(get).toHaveBeenCalledWith('/api/console/queries/pipeline-progress', {
      pipelineInstanceId: 42,
    })
  })

  it.each([403, 404, 500])(
    'propagates HTTP %s instead of returning empty steps',
    async (status) => {
      const error = { response: { status } }
      vi.mocked(get).mockRejectedValue(error)
      await expect(queryPipelineProgress(42)).rejects.toBe(error)
    },
  )
})
