// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, reactive, nextTick } from 'vue'

const elMessageBoxConfirmMock = vi.fn()
vi.mock('element-plus', () => ({
  ElMessageBox: {
    confirm: (...args: unknown[]) => elMessageBoxConfirmMock(...args),
  },
}))

vi.mock('@/locales', () => ({
  i18n: {
    global: {
      t: (k: string) => k,
      te: () => false,
    },
  },
}))

import { useDirtyForm } from './useDirtyForm'

beforeEach(() => {
  elMessageBoxConfirmMock.mockReset()
})

describe('useDirtyForm', () => {
  it('初始基线对齐 → isDirty=false', () => {
    const scope = effectScope()
    scope.run(() => {
      const form = reactive({ name: 'a', count: 0 })
      const { isDirty } = useDirtyForm(() => form)
      expect(isDirty.value).toBe(false)
    })
    scope.stop()
  })

  it('字段变化 → isDirty=true', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ name: 'a', count: 0 })
      const { isDirty } = useDirtyForm(() => form)
      form.name = 'b'
      await nextTick()
      expect(isDirty.value).toBe(true)
    })
    scope.stop()
  })

  it('markPristine 重置基线 → isDirty=false', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ name: 'a', items: [1, 2] })
      const { isDirty, markPristine } = useDirtyForm(() => form)
      form.name = 'b'
      form.items.push(3)
      await nextTick()
      expect(isDirty.value).toBe(true)
      markPristine()
      await nextTick()
      expect(isDirty.value).toBe(false)
    })
    scope.stop()
  })

  it('confirmDiscard:未脏直接 resolve true,不弹 confirm', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ name: 'a' })
      const { confirmDiscard } = useDirtyForm(() => form)
      const result = await confirmDiscard()
      expect(result).toBe(true)
      expect(elMessageBoxConfirmMock).not.toHaveBeenCalled()
    })
    scope.stop()
  })

  // 产品决策:抽屉关闭统一不再弹「放弃修改?」确认框,confirmDiscard 恒放行(返回 true)。
  it('confirmDiscard:已脏也直接 resolve true,不弹 confirm(统一去掉关闭确认)', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ name: 'a' })
      const { confirmDiscard } = useDirtyForm(() => form)
      form.name = 'b'
      await nextTick()
      const result = await confirmDiscard()
      expect(result).toBe(true)
      expect(elMessageBoxConfirmMock).not.toHaveBeenCalled()
    })
    scope.stop()
  })

  it('beforeunload:脏 + 启用 → preventDefault 被调用', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ x: 1 })
      const { isDirty } = useDirtyForm(() => form, { warnOnUnload: true })
      form.x = 2
      await nextTick()
      expect(isDirty.value).toBe(true)
      const evt = new Event('beforeunload') as BeforeUnloadEvent
      const prevent = vi.spyOn(evt, 'preventDefault')
      window.dispatchEvent(evt)
      expect(prevent).toHaveBeenCalled()
    })
    scope.stop()
  })

  it('beforeunload:enabled() === false → 不触发警告', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ x: 1 })
      useDirtyForm(() => form, { warnOnUnload: true, enabled: () => false })
      form.x = 2
      await nextTick()
      const evt = new Event('beforeunload') as BeforeUnloadEvent
      const prevent = vi.spyOn(evt, 'preventDefault')
      window.dispatchEvent(evt)
      expect(prevent).not.toHaveBeenCalled()
    })
    scope.stop()
  })

  it('深嵌套对象变化也能检测', async () => {
    const scope = effectScope()
    await scope.run(async () => {
      const form = reactive({ meta: { a: 1, b: { c: 2 } } })
      const { isDirty } = useDirtyForm(() => form)
      form.meta.b.c = 3
      await nextTick()
      expect(isDirty.value).toBe(true)
    })
    scope.stop()
  })
})
