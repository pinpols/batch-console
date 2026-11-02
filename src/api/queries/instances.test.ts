import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from '@/api/client'
import { queryJobInstances } from './instances'

vi.mock('@/api/client', () => ({ get: vi.fn() }))

describe('queryJobInstances', () => {
  beforeEach(() => vi.mocked(get).mockReset().mockResolvedValue({ items: [], total: 0 }))

  it('将精确作业编码传给服务端，保留原模糊筛选', async () => {
    await queryJobInstances({ tenantId: 'ta', exactJobCode: 'JOB_A', page: 2, pageSize: 15 })
    expect(get).toHaveBeenCalledWith('/api/console/queries/instances', {
      tenantId: 'ta',
      jobCode: 'JOB_A',
      exactJobCode: 'JOB_A',
      pageNo: 2,
      pageSize: 15,
    })
    await queryJobInstances({ tenantId: 'ta', jobCode: 'JOB', page: 1, pageSize: 15 })
    expect(get).toHaveBeenLastCalledWith('/api/console/queries/instances', {
      tenantId: 'ta',
      jobCode: 'JOB',
      pageNo: 1,
      pageSize: 15,
    })
  })
})
