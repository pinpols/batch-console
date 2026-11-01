import { describe, expect, it } from 'vitest'
import { windowPreview } from './windowPreview'

describe('批次窗口运行预览', () => {
  it('展示同日区间和跨日区间', () => {
    expect(windowPreview('08:00', '20:00', false)).toMatchObject({
      mode: 'same-day',
      segments: [{ start: 1 / 3, end: 5 / 6 }],
      rangeInvalid: false,
    })
    expect(windowPreview('20:00', '08:00', true)).toMatchObject({
      mode: 'overnight',
      segments: [
        { start: 0, end: 1 / 3 },
        { start: 5 / 6, end: 1 },
      ],
      rangeInvalid: false,
    })
    expect(windowPreview('20:00', '08:00', false)).toMatchObject({
      mode: 'overnight',
      rangeInvalid: true,
    })
  })
  it('与调度器一致地展示全天，并单独报告写入校验', () => {
    expect(windowPreview('08:00', '08:00', false)).toMatchObject({
      mode: 'full-day',
      rangeInvalid: true,
    })
    expect(windowPreview('08:00', '08:00', true)).toMatchObject({
      mode: 'full-day',
      rangeInvalid: false,
    })
    expect(windowPreview('08:00', '20:00', true)).toMatchObject({
      mode: 'full-day',
      fullDueCrossDay: true,
    })
  })
  it('不对不完整或无效输入推测运行区间', () => {
    expect(windowPreview('', '20:00', false).mode).toBe('incomplete')
    expect(windowPreview('25:00', '20:00', false).mode).toBe('incomplete')
  })
})
