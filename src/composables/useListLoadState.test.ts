import { describe, it, expect } from 'vitest'
import { useListLoadState } from './useListLoadState'

describe('useListLoadState', () => {
  it('成功路径:loading 起停 + error 始终 null + 返回值透传', async () => {
    const { loading, error, run } = useListLoadState()
    expect(loading.value).toBe(false)
    expect(error.value).toBe(null)

    const p = run(async () => {
      expect(loading.value).toBe(true)
      expect(error.value).toBe(null)
      return 42
    })
    const v = await p
    expect(v).toBe(42)
    expect(loading.value).toBe(false)
    expect(error.value).toBe(null)
  })

  it('失败路径:error 捕获 + rethrow 给外层(配合 runRefresh/Search 不发成功 toast)', async () => {
    const { loading, error, run } = useListLoadState()
    const boom = new Error('boom')
    await expect(
      run(async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
    expect(loading.value).toBe(false)
    expect(error.value).toBe(boom)
  })

  it('再次成功:error 清零,不卡上一次错误态', async () => {
    const { error, run } = useListLoadState()
    await run(async () => {
      throw new Error('first')
    }).catch(() => {})
    expect(error.value).toBeInstanceOf(Error)

    await run(async () => 'ok')
    expect(error.value).toBe(null)
  })
})
