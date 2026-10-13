import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDefinitionsPaged = vi.fn()
vi.mock('@/api/job', () => ({
  jobApi: { listDefinitionsPaged: (...args: unknown[]) => listDefinitionsPaged(...args) },
}))

import { useJobDefinitionDependencies } from './useJobDefinitionDependencies'

beforeEach(() => listDefinitionsPaged.mockReset())

describe('useJobDefinitionDependencies', () => {
  it('loads the selected definition, its direct predecessor, and paged direct dependents', async () => {
    listDefinitionsPaged
      .mockResolvedValueOnce({
        records: [{ jobCode: 'JOB_B', dependsOnJobCode: 'JOB_A' }],
        total: 1,
      })
      .mockResolvedValueOnce({ records: [{ jobCode: 'JOB_A', jobName: 'Upstream' }], total: 1 })
      .mockResolvedValueOnce({ records: [{ jobCode: 'JOB_C' }], total: 1 })
    const overview = useJobDefinitionDependencies()

    await overview.load('tenant-a', 'JOB_B')

    expect(listDefinitionsPaged).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-a',
      pageNo: 1,
      pageSize: 1,
      exactJobCode: 'JOB_B',
      includeDisabled: true,
    })
    expect(listDefinitionsPaged).toHaveBeenNthCalledWith(3, {
      tenantId: 'tenant-a',
      pageNo: 1,
      pageSize: 15,
      dependsOnJobCode: 'JOB_B',
      includeDisabled: true,
    })
    expect(overview.definition.value?.jobCode).toBe('JOB_B')
    expect(overview.upstream.value?.jobCode).toBe('JOB_A')
    expect(overview.downstream.value.map((row) => row.jobCode)).toEqual(['JOB_C'])
    expect(overview.downstreamTotal.value).toBe(1)
    expect(overview.hasError.value).toBe(false)
  })

  it('requests the next dependent page without reloading the current job or predecessor', async () => {
    listDefinitionsPaged
      .mockResolvedValueOnce({ records: [{ jobCode: 'JOB_B' }], total: 1 })
      .mockResolvedValueOnce({ records: [{ jobCode: 'JOB_C' }], total: 20 })
      .mockResolvedValueOnce({ records: [{ jobCode: 'JOB_D' }], total: 20 })
    const overview = useJobDefinitionDependencies()

    await overview.load('tenant-a', 'JOB_B')
    await overview.loadDownstreamPage('tenant-a', 'JOB_B', 2)

    expect(listDefinitionsPaged).toHaveBeenNthCalledWith(3, {
      tenantId: 'tenant-a',
      pageNo: 2,
      pageSize: 15,
      dependsOnJobCode: 'JOB_B',
      includeDisabled: true,
    })
    expect(overview.downstreamPage.value).toBe(2)
    expect(overview.downstream.value[0]?.jobCode).toBe('JOB_D')
  })

  it('clears tenant-specific dependency data when there is no tenant or job code', async () => {
    const overview = useJobDefinitionDependencies()
    await overview.load('', 'JOB_A')
    expect(listDefinitionsPaged).not.toHaveBeenCalled()
    expect(overview.definition.value).toBeNull()
    expect(overview.downstream.value).toEqual([])
  })

  it('discards an older response after the selected job changes', async () => {
    let resolveOldDefinition: ((value: unknown) => void) | undefined
    listDefinitionsPaged
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOldDefinition = resolve)))
      .mockResolvedValueOnce({ records: [{ jobCode: 'NEW_JOB' }], total: 1 })
      .mockResolvedValueOnce({ records: [], total: 0 })
    const overview = useJobDefinitionDependencies()
    const oldLoad = overview.load('tenant-a', 'OLD_JOB')
    await overview.load('tenant-a', 'NEW_JOB')

    resolveOldDefinition?.({ records: [{ jobCode: 'OLD_JOB' }], total: 1 })
    await oldLoad

    expect(overview.definition.value?.jobCode).toBe('NEW_JOB')
    expect(overview.downstreamTotal.value).toBe(0)
  })
})
