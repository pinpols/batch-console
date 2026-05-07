import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, ref } from 'vue'

const elMessageSuccessMock = vi.fn()

vi.mock('element-plus', () => ({
  ElMessage: {
    success: (...args: unknown[]) => elMessageSuccessMock(...args),
  },
}))

import { useListFilterFeedback } from './useListFilterFeedback'

beforeEach(() => {
  elMessageSuccessMock.mockReset()
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
  it('runSearch 完成后 toast "已按条件更新列表"', async () => {
    const { api, dispose } = setup()
    await api.runSearch(() => {})
    expect(elMessageSuccessMock).toHaveBeenCalledTimes(1)
    expect(elMessageSuccessMock.mock.calls[0][0]).toMatchObject({ message: '已按条件更新列表' })
    dispose()
  })

  it('runReset 完成后 toast "已重置筛选条件"', async () => {
    const { api, dispose } = setup()
    await api.runReset(() => {})
    expect(elMessageSuccessMock.mock.calls[0][0]).toMatchObject({ message: '已重置筛选条件' })
    dispose()
  })

  it('runRefresh 完成后 toast "已刷新"', async () => {
    const { api, dispose } = setup()
    await api.runRefresh(() => {})
    expect(elMessageSuccessMock.mock.calls[0][0]).toMatchObject({ message: '已刷新' })
    dispose()
  })

  it('内部函数抛错时不发 toast,且 filterBusy 能复位', async () => {
    const { api, dispose } = setup()
    await expect(
      api.runSearch(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(elMessageSuccessMock).not.toHaveBeenCalled()
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
