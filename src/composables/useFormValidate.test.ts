import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'

const elMessageWarningMock = vi.fn()
vi.mock('element-plus', () => ({
  ElMessage: {
    warning: (...args: unknown[]) => elMessageWarningMock(...args),
  },
}))

import { rules, useFormValidate } from './useFormValidate'

beforeEach(() => {
  elMessageWarningMock.mockClear()
})

describe('useFormValidate rules', () => {
  it('required 默认 blur', () => {
    expect(rules.required('必填')).toMatchObject({
      required: true,
      message: '必填',
      trigger: 'blur',
    })
  })

  it('code 校验:字母开头 + 字母/数字/_/-', () => {
    const r = rules.code()
    expect((r.pattern as RegExp | undefined)?.test('jobOrder_v2')).toBe(true)
    expect((r.pattern as RegExp | undefined)?.test('1abc')).toBe(false) // 数字开头不行
    expect((r.pattern as RegExp | undefined)?.test('a-b-c')).toBe(true)
    expect((r.pattern as RegExp | undefined)?.test('a b')).toBe(false) // 含空格不行
  })

  it('tenantId 校验:3-64 长度,字母/数字/连字符', () => {
    const r = rules.tenantId()
    expect((r.pattern as RegExp | undefined)?.test('tenant-001')).toBe(true)
    expect((r.pattern as RegExp | undefined)?.test('ab')).toBe(false) // 太短
    expect((r.pattern as RegExp | undefined)?.test('a'.repeat(65))).toBe(false) // 太长
    expect((r.pattern as RegExp | undefined)?.test('A_B')).toBe(false) // 不允许 _
  })

  it('minLength / maxLength', () => {
    expect(rules.minLength(3)).toMatchObject({ min: 3 })
    expect(rules.maxLength(64)).toMatchObject({ max: 64 })
  })
})

describe('useFormValidate.validate()', () => {
  function setup() {
    const scope = effectScope()
    let api!: ReturnType<typeof useFormValidate>
    scope.run(() => {
      api = useFormValidate()
    })
    return { api, dispose: () => scope.stop() }
  }

  it('formRef 未挂载时 validate() 返回 false 不抛', async () => {
    const { api, dispose } = setup()
    expect(await api.validate()).toBe(false)
    dispose()
  })

  it('校验通过时返回 true 不发 toast', async () => {
    const { api, dispose } = setup()
    api.formRef.value = {
      validate: () => Promise.resolve(true),
      scrollToField: vi.fn(),
    } as never
    expect(await api.validate()).toBe(true)
    expect(elMessageWarningMock).not.toHaveBeenCalled()
    dispose()
  })

  it('校验失败:返回 false + toast 第一条 message + 自动滚到第一个错误项', async () => {
    const { api, dispose } = setup()
    const scrollToField = vi.fn()
    api.formRef.value = {
      validate: () =>
        Promise.reject({
          tenantId: [{ message: 'tenantId 必填' }, { message: '另一个错' }],
          name: [{ message: 'name 必填' }],
        }),
      scrollToField,
    } as never
    expect(await api.validate()).toBe(false)
    expect(elMessageWarningMock).toHaveBeenCalledWith('tenantId 必填')
    expect(scrollToField).toHaveBeenCalledWith('tenantId')
    dispose()
  })

  it('silent 模式失败不发 toast', async () => {
    const { api, dispose } = setup()
    api.formRef.value = {
      validate: () => Promise.reject({ name: [{ message: 'x' }] }),
      scrollToField: vi.fn(),
    } as never
    expect(await api.validate({ silent: true })).toBe(false)
    expect(elMessageWarningMock).not.toHaveBeenCalled()
    dispose()
  })
})
