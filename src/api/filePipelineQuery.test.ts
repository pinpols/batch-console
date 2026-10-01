import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import {
  queryFileDispatchPage,
  queryFileErrorPage,
  queryFilePipelinePage,
  queryFilePipelineStepPage,
} from './filePipelineQuery'

const mockedGet = vi.mocked(get)
const params = { tenantId: 'ta', pageNo: 2, pageSize: 15, keyword: 'failed' }

describe('filePipelineQuery', () => {
  beforeEach(() => mockedGet.mockReset())

  it.each([
    ['/api/console/queries/file-pipelines', queryFilePipelinePage],
    ['/api/console/queries/file-pipeline-steps', queryFilePipelineStepPage],
    ['/api/console/queries/file-dispatches', queryFileDispatchPage],
    ['/api/console/queries/file-errors', queryFileErrorPage],
  ])('%s 传递租户、页码和关键字', async (path, query) => {
    mockedGet.mockResolvedValue({ items: [], total: 0 })

    await query(params)

    expect(mockedGet).toHaveBeenCalledWith(path, params)
  })
})
