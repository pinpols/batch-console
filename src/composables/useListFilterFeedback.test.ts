import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, ref } from 'vue'

const elMessageMock = vi.fn()

vi.mock('element-plus', () => ({
  // ElMessage 在源码里以 callable 形式调用(`ElMessage({...})`),mock 也按 callable 实现
  ElMessage: (...args: unknown[]) => elMessageMock(...args),
}))

import { useListFilterFeedback } from './useListFilterFeedback'

beforeEach(() => {
  elMessageMock.mockReset()
})

function setup() {
  const remote = ref(false)
  const scope = effectScope()
  let api!: ReturnType<typeof useListFilterFeedback>
  scope.run(() => {
    api = useListFilterFeedback(remote)
  })
  return { remote, api, dispose: () => scope.stop() }
}

describe('useListFilterFeedback', () => {
  it('runSearch 完成后 toast "已按条件更新列表"(success + grouping + plain)', async () => {
    const { api, dispose } = setup()
    await api.runSearch(() => {})
    expect(elMessageMock).toHaveBeenCalledTimes(1)
    expect(elMessageMock.mock.calls[0][0]).toMatchObject({
      message: '已按条件更新列表',
      type: 'success',
      plain: true,
      grouping: true,
      customClass: 'filter-feedback-toast',
    })
    dispose()
  })

  it('runReset 完成后 toast "已重置筛选条件"(info 色,区别于 success)', async () => {
    const { api, dispose } = setup()
    await api.runReset(() => {})
    expect(elMessageMock.mock.calls[0][0]).toMatchObject({
      message: '已重置筛选条件',
      type: 'info',
    })
    dispose()
  })

  it('runRefresh 完成后 toast "已刷新"', async () => {
    const { api, dispose } = setup()
    await api.runRefresh(() => {})
    expect(elMessageMock.mock.calls[0][0]).toMatchObject({
      message: '已刷新',
      type: 'success',
    })
    dispose()
  })

  it('内部函数抛错时不发 toast,且 filterBusy 能复位', async () => {
    const { api, dispose } = setup()
    await expect(
      api.runSearch(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(elMessageMock).not.toHaveBeenCalled()
    expect(api.filterBusy.value).toBe(false)
    dispose()
  })

  it('tableBlocking 合并 remote loading 与 filterBusy', async () => {
    const { remote, api, dispose } = setup()
    expect(api.tableBlocking.value).toBe(false)
    remote.value = true
    expect(api.tableBlocking.value).toBe(true)
    remote.value = false
    expect(api.tableBlocking.value).toBe(false)
    dispose()
  })
})
