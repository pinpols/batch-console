import { describe, expect, it } from 'vitest'
import { buildTimetable, type TimetableInstance } from './timetable'

const HOUR = 3_600_000
// 业务日 2026-11-03 在 Asia/Shanghai 的零点
const DAY_START = Date.parse('2026-11-02T16:00:00Z')

function instance(partial: Partial<TimetableInstance>): TimetableInstance {
  return {
    id: 1,
    jobCode: 'TA_COV_IMPORT',
    workerGroup: 'IMPORT',
    instanceStatus: 'SUCCESS',
    startedAt: new Date(DAY_START + 6 * HOUR).toISOString(),
    finishedAt: new Date(DAY_START + 7 * HOUR).toISOString(),
    ...partial,
  }
}

describe('buildTimetable', () => {
  it('按 Worker 组分道并按 24 小时轴换算位置', () => {
    const table = buildTimetable(
      [instance({ id: 1 }), instance({ id: 2, workerGroup: 'EXPORT', jobCode: 'TA_COV_EXPORT' })],
      { dayStartMs: DAY_START, nowMs: DAY_START + 12 * HOUR },
    )
    expect(table.lanes.map((lane) => lane.key)).toEqual(['EXPORT', 'IMPORT'])
    const segment = table.lanes[1].segments[0]
    expect(segment.left).toBeCloseTo(25)
    expect(segment.width).toBeCloseTo(100 / 24)
    expect(segment.tone).toBe('success')
    expect(table.nowPercent).toBeCloseTo(50)
    expect(table.ticks.map((tick) => tick.label)).toEqual([
      '00:00',
      '04:00',
      '08:00',
      '12:00',
      '16:00',
      '20:00',
      '24:00',
    ])
  })

  it('运行中的实例画到当前时间，失败实例使用失败色', () => {
    const table = buildTimetable(
      [
        instance({ id: 1, instanceStatus: 'RUNNING', finishedAt: null }),
        instance({ id: 2, instanceStatus: 'FAILED' }),
      ],
      { dayStartMs: DAY_START, nowMs: DAY_START + 9 * HOUR },
    )
    const [running, failed] = table.lanes[0].segments
    expect(running.tone).toBe('running')
    expect(running.left + running.width).toBeCloseTo(37.5)
    expect(failed.tone).toBe('danger')
  })

  it('跨过业务日的运行把轴延长到整点，并保留极短运行的最小可见宽度', () => {
    const table = buildTimetable(
      [
        instance({
          id: 1,
          startedAt: new Date(DAY_START + 23 * HOUR).toISOString(),
          finishedAt: new Date(DAY_START + 25.5 * HOUR).toISOString(),
        }),
        instance({
          id: 2,
          startedAt: new Date(DAY_START + HOUR).toISOString(),
          finishedAt: new Date(DAY_START + HOUR + 2000).toISOString(),
        }),
      ],
      { dayStartMs: DAY_START, nowMs: DAY_START + 30 * HOUR },
    )
    expect(table.axisHours).toBe(26)
    expect(table.nowPercent).toBeNull()
    const short = table.lanes[0].segments.find((segment) => segment.id === 2)
    expect(short?.width).toBeGreaterThan(0.3)
  })

  it('未开始或缺少开始时间的实例只计数，不伪造位置；缺 Worker 组归入未分组', () => {
    const table = buildTimetable(
      [
        instance({ id: 1, startedAt: null, finishedAt: null, instanceStatus: 'PENDING' }),
        instance({ id: 2, workerGroup: null }),
      ],
      { dayStartMs: DAY_START, nowMs: DAY_START + HOUR },
    )
    expect(table.notStarted).toBe(1)
    expect(table.lanes.map((lane) => lane.key)).toEqual([''])
    expect(table.lanes[0].segments).toHaveLength(1)
  })
})
