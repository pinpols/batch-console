import { describe, it, expect } from 'vitest'
import { rules } from './useFormValidate'

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
    expect(r.pattern?.test('jobOrder_v2')).toBe(true)
    expect(r.pattern?.test('1abc')).toBe(false) // 数字开头不行
    expect(r.pattern?.test('a-b-c')).toBe(true)
    expect(r.pattern?.test('a b')).toBe(false) // 含空格不行
  })

  it('tenantId 校验:3-64 长度,字母/数字/连字符', () => {
    const r = rules.tenantId()
    expect(r.pattern?.test('tenant-001')).toBe(true)
    expect(r.pattern?.test('ab')).toBe(false) // 太短
    expect(r.pattern?.test('a'.repeat(65))).toBe(false) // 太长
    expect(r.pattern?.test('A_B')).toBe(false) // 不允许 _
  })

  it('minLength / maxLength', () => {
    expect(rules.minLength(3)).toMatchObject({ min: 3 })
    expect(rules.maxLength(64)).toMatchObject({ max: 64 })
  })
})
