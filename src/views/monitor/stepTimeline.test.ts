import { describe, expect, it } from 'vitest'
import { buildStepTimeline } from './stepTimeline'

const at = (s: number) => new Date(Date.UTC(2026, 10, 4, 0, 0, s)).toISOString()

describe('buildStepTimeline', () => {
  it('按开始时间排列步骤，位置和宽度按整段耗时换算', () => {
    const result = buildStepTimeline(
      [
        { id: 2, stepCode: 'LOAD', stepStatus: 'SUCCESS', startedAt: at(20), finishedAt: at(100) },
        { id: 1, stepCode: 'PARSE', stepStatus: 'SUCCESS', startedAt: at(0), finishedAt: at(20) },
      ],
      Date.parse(at(200)),
    )
    expect(result.spanMs).toBe(100_000)
    expect(result.bars.map((bar) => [bar.stepCode, bar.left, bar.width, bar.tone])).toEqual([
      ['PARSE', 0, 20, 'success'],
      ['LOAD', 20, 80, 'success'],
    ])
  })

  it('未结束的步骤画到当前时间，未开始的只计数', () => {
    const result = buildStepTimeline(
      [
        { id: 1, stepCode: 'PARSE', stepStatus: 'SUCCESS', startedAt: at(0), finishedAt: at(10) },
        { id: 2, stepCode: 'LOAD', stepStatus: 'RUNNING', startedAt: at(10), finishedAt: null },
        { id: 3, stepCode: 'FEEDBACK', stepStatus: 'PENDING', startedAt: null },
      ],
      Date.parse(at(40)),
    )
    expect(result.notStarted).toBe(1)
    const load = result.bars[1]
    expect(load).toMatchObject({
      open: true,
      tone: 'running',
      durationMs: 30_000,
      left: 25,
      width: 75,
    })
  })

  it('极短步骤保留最小可见宽度且不越出轴尾', () => {
    const result = buildStepTimeline(
      [
        { id: 1, stepCode: 'A', stepStatus: 'SUCCESS', startedAt: at(0), finishedAt: at(100) },
        { id: 2, stepCode: 'B', stepStatus: 'FAILED', startedAt: at(100), finishedAt: at(100) },
      ],
      Date.parse(at(100)),
    )
    const b = result.bars[1]
    expect(b.tone).toBe('danger')
    expect(b.width).toBeGreaterThan(0)
    expect(b.left + b.width).toBeLessThanOrEqual(100)
  })
})
