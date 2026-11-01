import { describe, expect, it } from 'vitest'
import { queuePartitionCapacity, summarizeWorkerStates } from './schedulerSnapshotPresentation'

describe('scheduler snapshot worker summary', () => {
  it('counts only returned worker states and keeps unknown separate', () => {
    expect(
      summarizeWorkerStates([
        { status: 'ONLINE' },
        { status: 'offline' },
        { status: 'DRAINING' },
        { status: null },
      ]),
    ).toEqual({ online: 1, offline: 1, draining: 1, unknown: 1 })
  })
})

describe('queue partition capacity', () => {
  it('uses the explicit partition limit and leaves missing or unlimited limits unknown', () => {
    expect(queuePartitionCapacity(4, 10)).toEqual({ active: 4, limit: 10, percent: 40 })
    expect(queuePartitionCapacity(12, 10)).toEqual({ active: 12, limit: 10, percent: 100 })
    expect(queuePartitionCapacity(0, 0)).toBeNull()
    expect(queuePartitionCapacity(undefined, 10)).toBeNull()
  })
})
