import { describe, expect, it } from 'vitest'
import { truncateDisplayText } from './text'

describe('truncateDisplayText', () => {
  it('keeps short values unchanged', () => {
    expect(truncateDisplayText('admin', 8)).toBe('admin')
  })

  it('truncates CJK text by characters rather than bytes', () => {
    expect(truncateDisplayText('调度平台管理员账号', 6)).toBe('调度平台管…')
  })

  it('does not split a surrogate pair', () => {
    expect(truncateDisplayText('ops🛠️owner', 5)).toBe('ops🛠…')
  })
})
