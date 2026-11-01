import { describe, expect, it } from 'vitest'
import { buildTraceTimeline } from './traceTimeline'

describe('buildTraceTimeline', () => {
  it('preserves the server order and its exact event fields', () => {
    const events = [
      {
        source: 'FILE_RECORD',
        eventType: 'STATUS',
        referenceId: 2,
        status: 'READY',
        message: 'file-2',
        occurredAt: '2026-01-01T09:00:00Z',
      },
      {
        source: 'JOB_INSTANCE',
        eventType: 'STATUS',
        referenceId: 1,
        status: 'RUNNING',
        message: 'job-1',
        occurredAt: '2026-01-01T10:00:00Z',
      },
    ]
    expect(buildTraceTimeline(events)).toEqual({
      available: true,
      events: [
        { ...events[0], referenceId: '2' },
        { ...events[1], referenceId: '1' },
      ],
    })
  })
  it('distinguishes missing timelines, empty timelines and incomplete events', () => {
    expect(buildTraceTimeline(undefined)).toEqual({ available: false, events: [] })
    expect(buildTraceTimeline([])).toEqual({ available: true, events: [] })
    expect(
      buildTraceTimeline([{ source: 'UNKNOWN', referenceId: 0, occurredAt: 'invalid' }]),
    ).toEqual({
      available: true,
      events: [
        {
          source: 'UNKNOWN',
          eventType: null,
          referenceId: '0',
          status: null,
          message: null,
          occurredAt: null,
        },
      ],
    })
  })
})
