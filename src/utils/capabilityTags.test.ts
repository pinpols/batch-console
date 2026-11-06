import { describe, expect, it } from 'vitest'
import { parseCapabilityTags } from './capabilityTags'

describe('Worker 能力标签解析', () => {
  it('JSON 数组字符串拆成标签', () => {
    expect(parseCapabilityTags('["report", "dry-run-safe"]')).toEqual(['report', 'dry-run-safe'])
  })
  it('逗号分隔与数组输入都能处理，空值返回空数组', () => {
    expect(parseCapabilityTags('SHELL, SQL')).toEqual(['SHELL', 'SQL'])
    expect(parseCapabilityTags(['a', 'b'])).toEqual(['a', 'b'])
    expect(parseCapabilityTags('')).toEqual([])
    expect(parseCapabilityTags(null)).toEqual([])
  })
  it('不合法的 JSON 按逗号分隔兜底', () => {
    expect(parseCapabilityTags('["a", "b"')).toEqual(['a', 'b'])
  })
})
