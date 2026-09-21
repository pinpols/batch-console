import { describe, expect, it } from 'vitest'
import type { WorkerFingerprint } from '@/api/workerFingerprint'
import { summarizeWorkerFingerprints } from './workerFingerprintPresentation'

function worker(overrides: Partial<WorkerFingerprint>): WorkerFingerprint {
  return {
    id: 1,
    tenantId: 'ta',
    workerCode: 'w1',
    status: 'ONLINE',
    buildId: 'build-a',
    sdkVersion: '1.0.0',
    ...overrides,
  }
}

describe('summarizeWorkerFingerprints', () => {
  it('uses the largest active fingerprint as baseline and counts drift', () => {
    const result = summarizeWorkerFingerprints(
      [
        worker({ workerCode: 'w1' }),
        worker({ workerCode: 'w2', buildId: 'build-b' }),
        worker({ workerCode: 'w3', status: 'DRAINING' }),
        worker({ workerCode: 'w4', status: 'OFFLINE', buildId: 'build-b' }),
      ],
      [
        { buildId: 'build-a', sdkVersion: '1.0.0', count: 2 },
        { buildId: 'build-b', sdkVersion: '1.0.0', count: 1 },
      ],
    )
    expect(result).toMatchObject({
      total: 4,
      online: 2,
      draining: 1,
      offline: 1,
      versions: 2,
      dominantBuild: 'build-a',
      drifted: 1,
    })
  })
})
