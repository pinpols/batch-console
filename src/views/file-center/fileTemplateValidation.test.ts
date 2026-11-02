import { describe, expect, it } from 'vitest'
import { createFileTemplateValidation, optionalText } from './fileTemplateValidation'

const validation = createFileTemplateValidation((key, label) => `${key}|${label}`)

describe('fileTemplateValidation', () => {
  it('去除可选文本的首尾空白并将空值转为 undefined', () => {
    expect(optionalText('  value  ')).toBe('value')
    expect(optionalText('  ')).toBeUndefined()
  })

  it('必填文本为空时保留包含字段名的本地化提示', () => {
    expect(validation.requireText(' SFTP ', '类型')).toBe('SFTP')
    expect(() => validation.requireText(' ', '类型')).toThrow(
      'fileTemplateList.validationRequired|类型',
    )
  })

  it('接受合法资源编码和 128 位边界，拒绝无效编码与 129 位', () => {
    expect(validation.requireCode(' A_1-b ', '编码')).toBe('A_1-b')
    expect(validation.requireCode('A' + 'x'.repeat(127), '编码')).toHaveLength(128)
    for (const value of ['1-invalid', '含中文', 'A with space', 'A' + 'x'.repeat(128)]) {
      expect(() => validation.requireCode(value, '编码')).toThrow(
        'fileTemplateList.validationCodeFormat|编码',
      )
    }
    expect(() => validation.requireCode(' ', '编码')).toThrow(
      'fileTemplateList.validationRequired|编码',
    )
  })
})
