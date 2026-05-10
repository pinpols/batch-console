import { describe, it, expect } from 'vitest'
import { formatMetaOptionLabel } from './formatMetaOptionLabel'

describe('formatMetaOptionLabel', () => {
  it('label !== value 时拼 `中文 (CODE)`', () => {
    expect(formatMetaOptionLabel({ value: 'CRITICAL', label: '严重' })).toBe('严重 (CRITICAL)')
    expect(formatMetaOptionLabel({ value: 'EMAIL', label: 'Email 渠道' })).toBe(
      'Email 渠道 (EMAIL)',
    )
  })

  it('label === value(纯字符串列表,无翻译)只显示 value', () => {
    expect(formatMetaOptionLabel({ value: 'ORDER_DAILY', label: 'ORDER_DAILY' })).toBe(
      'ORDER_DAILY',
    )
    expect(formatMetaOptionLabel({ value: 'WORKDAY_2026', label: 'WORKDAY_2026' })).toBe(
      'WORKDAY_2026',
    )
  })
})
