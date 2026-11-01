import { describe, expect, it } from 'vitest'
import { batchDayTimeline, filterScheduledOccurrences } from './batchDayTimeline'

describe('批次日时间线', () => {
  it('按时间线索排列计划触发和服务端窗口快照，不把快照当计划', () => {
    const result = batchDayTimeline(
      {
        currentSystemTime: '2026-10-31T12:00:00Z',
        cutoffAt: '2026-10-31T13:00:00Z',
        slaDeadlineAt: '2026-10-31T14:00:00Z',
        lateArrivalWindowClosesAt: null,
      },
      [
        {
          workflowDefinitionId: 2,
          workflowCode: 'B',
          scheduledFireTime: '2026-10-31T20:30:00+08:00',
          scheduleVersion: 1,
          bizDate: '2026-10-31',
          catchUpPolicy: 'AUTO',
          occurrenceStatus: 'PLANNED',
          actualFires: [
            { fireInstanceId: 'fire-1', refireCount: 0, actualFireTime: '2026-10-31T12:31:00Z', fireKind: 'SCHEDULED' },
            { fireInstanceId: 'fire-2', refireCount: 0, actualFireTime: '2026-10-31T12:32:00Z', fireKind: 'READINESS_RETRY' },
          ],
        },
        {
          workflowDefinitionId: 1,
          workflowCode: 'A',
          scheduledFireTime: '2026-10-31T11:00:00Z',
          scheduleVersion: 1,
          bizDate: '2026-10-31',
          catchUpPolicy: 'AUTO',
          occurrenceStatus: 'PLANNED',
          actualFires: [],
        },
      ],
    )
    expect(result.events.map((item) => item.kind)).toEqual([
      'scheduled',
      'snapshot',
      'scheduled',
      'actual',
      'actual',
      'cutoff',
      'sla',
    ])
    expect(
      result.events
        .filter((item) => item.kind === 'scheduled')
        .map((item) => item.occurrence?.workflowCode),
    ).toEqual(['A', 'B'])
    expect(result.invalidOccurrences).toBe(0)
    expect(result.events.filter((item) => item.kind === 'actual').map((item) => item.fire?.fireKind)).toEqual(['SCHEDULED', 'READINESS_RETRY'])
  })
  it('无效或未标明时区的时间不进入时间线', () => {
    const result = batchDayTimeline(
      {
        currentSystemTime: '',
        cutoffAt: 'broken',
        slaDeadlineAt: null,
        lateArrivalWindowClosesAt: null,
      },
      [
        {
          workflowDefinitionId: 1,
          workflowCode: 'A',
          scheduledFireTime: '2026-10-31T11:00:00',
          scheduleVersion: 1,
          bizDate: '2026-10-31',
          catchUpPolicy: 'AUTO',
          occurrenceStatus: 'PLANNED',
          actualFires: [],
        },
      ],
    )
    expect(result.events).toEqual([])
    expect(result.invalidOccurrences).toBe(1)
    const badDate = batchDayTimeline(
      {
        currentSystemTime: '',
        cutoffAt: '2026-02-30T12:00:00Z',
        slaDeadlineAt: null,
        lateArrivalWindowClosesAt: null,
      },
      [],
    )
    expect(badDate.events).toEqual([])
    expect(
      filterScheduledOccurrences(
        [
          {
            workflowDefinitionId: 1,
            workflowCode: 'A',
            scheduledFireTime: '2026-10-31T11:00:00',
            scheduleVersion: 1,
            bizDate: '2026-10-31',
            catchUpPolicy: 'AUTO',
            occurrenceStatus: 'PLANNED',
            actualFires: [],
          },
        ],
        'A',
        'PLANNED',
      ),
    ).toHaveLength(1)
  })
})
