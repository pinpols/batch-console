// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useInfiniteList, type InfiniteListPage } from './useInfiniteList'

function setup(fetchPage: (page: number, size: number) => Promise<InfiniteListPage<string>>) {
  let list!: ReturnType<typeof useInfiniteList<string>>
  const wrapper = mount({
    setup() {
      list = useInfiniteList({ fetchPage, pageSize: 2 })
      return () => null
    },
  })
  return { list, wrapper }
}

describe('无限列表在途重置', () => {
  it('切换范围时立即加载新首页，旧首页晚到不覆盖新范围且加载态恢复', async () => {
    let resolveOld!: (result: InfiniteListPage<string>) => void
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce({ rows: ['tenant-b'], total: 1 })
    const { list, wrapper } = setup(fetchPage)
    try {
      await list.reset()
      resolveOld({ rows: ['tenant-a'], total: 1 })
      await flushPromises()
      expect(fetchPage).toHaveBeenCalledTimes(2)
      expect(list.rows.value).toEqual(['tenant-b'])
      expect(list.page.value).toBe(1)
      expect(list.loading.value).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('仅重置时释放旧加载态，后续手工加载能够重新开始', async () => {
    let resolveOld!: (result: InfiniteListPage<string>) => void
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce({ rows: ['new-filter'], total: 1 })
    const { list, wrapper } = setup(fetchPage)
    try {
      await list.reset(false)
      resolveOld({ rows: ['old-filter'], total: 1 })
      await flushPromises()
      await list.loadMore()
      expect(fetchPage).toHaveBeenCalledTimes(2)
      expect(list.rows.value).toEqual(['new-filter'])
      expect(list.loading.value).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('同范围连续加载保留分页、总数和结束条件', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ rows: ['a', 'b'], total: 3 })
      .mockResolvedValueOnce({ rows: ['c'], total: 3 })
    const { list, wrapper } = setup(fetchPage)
    await flushPromises()
    await list.loadMore()
    expect(fetchPage.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ])
    expect(list.rows.value).toEqual(['a', 'b', 'c'])
    expect(list.total.value).toBe(3)
    expect(list.hasMore.value).toBe(false)
    wrapper.unmount()
  })
})
