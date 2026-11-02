// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, reactive, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'

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
  setActivePinia(createPinia())
})

describe('useDirtyForm', () => {
  it.each(['dirty', 'clean'])('确认期间 %s 草稿变化后即使恢复原值也不切换', async (which) => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = effectScope()
    const dirty = reactive({ name: 'a' })
    const clean = reactive({ name: 'a' })
    scope.run(() => {
      useDirtyForm(() => dirty)
      useDirtyForm(() => clean)
    })
    dirty.name = 'edited'
    let finish!: (value: boolean) => void
    const pending = tenant.requestTenantSwitch(
      'tenant-b',
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const target = which === 'dirty' ? dirty : clean
    const previous = target.name
    target.name = 'changed-during-confirmation'
    target.name = previous
    finish(true)
    expect(await pending).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
    const confirmAgain = vi.fn(async () => true)
    expect(await tenant.requestTenantSwitch('tenant-b', confirmAgain)).toBe(true)
    expect(confirmAgain).toHaveBeenCalledOnce()
    scope.stop()
  })
  it('刚输入立即切租户也检查最新草稿，失活和销毁后不拦截', async () => {
    const tenant = useTenantStore()
    tenant.setTenantId('tenant-a')
    const scope = effectScope()
    const form = reactive({ name: 'a' })
    let enabled = true
    scope.run(() => useDirtyForm(() => form, { enabled: () => enabled }))
    form.name = 'b'
    const confirm = vi.fn(async () => false)
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
    expect(tenant.tenantId).toBe('tenant-a')
    expect(confirm).toHaveBeenCalledTimes(1)
    enabled = false
    expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
    enabled = true
    scope.stop()
    expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
  })
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
