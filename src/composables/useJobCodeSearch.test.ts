import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { effectScope } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { stubLocalStorage } from '@/test-utils/localStorage'

const listDefinitionsPagedMock = vi.fn()
const searchDefinitionsMock = vi.fn()
vi.mock('@/api/job', () => ({
  jobApi: {
    listDefinitionsPaged: (...args: unknown[]) => listDefinitionsPagedMock(...args),
    searchDefinitions: (...args: unknown[]) => searchDefinitionsMock(...args),
  },
}))

const storage = stubLocalStorage()

import { JOB_CODE_SEARCH_PAGE_SIZE, useJobCodeSearch } from './useJobCodeSearch'

beforeEach(() => {
  listDefinitionsPagedMock.mockReset()
  searchDefinitionsMock.mockReset()
  storage.clear()
  setActivePinia(createPinia())
  useTenantStore().setTenantId('tenant-a')
})

function setup() {
  const scope = effectScope()
  let api!: ReturnType<typeof useJobCodeSearch>
  scope.run(() => {
    api = useJobCodeSearch()
  })
  return { api, dispose: () => scope.stop() }
}

describe('useJobCodeSearch', () => {
  it('loadDefaultJobCodes:首次拉 30 条启用 job,去重 + filter 空字符串', async () => {
    listDefinitionsPagedMock.mockResolvedValue({
      records: [
        { jobCode: 'a' },
        { jobCode: 'a' }, // 重复
        { jobCode: '' }, // 空
        { jobCode: 'b' },
        { jobCode: null }, // 非字符串
      ],
    })
    const { api, dispose } = setup()
    await api.loadDefaultJobCodes()
    expect(listDefinitionsPagedMock).toHaveBeenCalledWith({
      tenantId: expect.any(String),
      pageNo: 1,
      pageSize: JOB_CODE_SEARCH_PAGE_SIZE,
      enabled: true,
    })
    expect(api.jobCodeOptions.value).toEqual(['a', 'b'])
    dispose()
  })

  it('loadDefaultJobCodes:已经有数据时跳过(避免重复请求)', async () => {
    listDefinitionsPagedMock.mockResolvedValue({ records: [{ jobCode: 'a' }] })
    const { api, dispose } = setup()
    await api.loadDefaultJobCodes()
    expect(listDefinitionsPagedMock).toHaveBeenCalledTimes(1)
    await api.loadDefaultJobCodes()
    expect(listDefinitionsPagedMock).toHaveBeenCalledTimes(1) // 不重复
    dispose()
  })

  it('loadDefaultJobCodes:加载中时跳过(避免并发重复请求)', async () => {
    let resolveFn!: (v: unknown) => void
    listDefinitionsPagedMock.mockReturnValue(
      new Promise((r) => {
        resolveFn = r
      }),
    )
    const { api, dispose } = setup()
    const p1 = api.loadDefaultJobCodes()
    const p2 = api.loadDefaultJobCodes() // 加载中,应跳过
    expect(listDefinitionsPagedMock).toHaveBeenCalledTimes(1)
    resolveFn({ records: [{ jobCode: 'a' }] })
    await p1
    await p2
    dispose()
  })

  it('API 失败时 jobCodeOptions 复位为空', async () => {
    listDefinitionsPagedMock.mockRejectedValue(new Error('500'))
    const { api, dispose } = setup()
    await api.loadDefaultJobCodes()
    expect(api.jobCodeOptions.value).toEqual([])
    expect(api.jobCodeLoading.value).toBe(false)
    dispose()
  })
  it('切换租户后丢弃旧租户的默认候选项，并允许新租户立即加载', async () => {
    let resolveA!: (value: unknown) => void
    listDefinitionsPagedMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveA = resolve
        }),
      )
      .mockResolvedValueOnce({ records: [{ jobCode: 'B-job' }] })
    const { api, dispose } = setup()
    const pending = api.loadDefaultJobCodes()
    useTenantStore().setTenantId('tenant-b')
    await api.loadDefaultJobCodes()
    resolveA({ records: [{ jobCode: 'A-job' }] })
    await pending
    expect(api.jobCodeOptions.value).toEqual(['B-job'])
    dispose()
  })

  it('后发关键词结果优先于先发的迟到结果', async () => {
    let resolveOld!: (value: unknown) => void
    listDefinitionsPagedMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce({ records: [{ jobCode: 'latest-job' }] })
    const { api, dispose } = setup()
    const pending = api.queryJobCodes('old')
    await api.queryJobCodes('latest')
    resolveOld({ records: [{ jobCode: 'old-job' }] })
    await pending
    expect(api.jobCodeOptions.value).toEqual(['latest-job'])
    dispose()
  })
})
