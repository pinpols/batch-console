import { describe, expect, it } from 'vitest'
import {
  buildOnboardingChecklist,
  onboardingPreferenceKey,
  type OnboardingEvidence,
} from './onboardingModel'

function evidence(overrides: Partial<OnboardingEvidence> = {}): OnboardingEvidence {
  return {
    tenantId: 'tenant-a',
    jobDefinitionCount: 0,
    runCount: 0,
    successfulRunCount: 0,
    onlineWorkerCount: 0,
    readiness: { tenantId: 'tenant-a', ready: false, blocking: [], warnings: [] },
    readinessSupported: true,
    failedSources: [],
    ...overrides,
  }
}

describe('buildOnboardingChecklist', () => {
  it('builds an evidence-driven configuration journey for tenant administrators', () => {
    const result = buildOnboardingChecklist({
      role: 'ROLE_TENANT_ADMIN',
      evidence: evidence(),
    })

    expect(result.steps.map((step) => [step.id, step.status])).toEqual([
      ['tenant-context', 'completed'],
      ['job-config', 'current'],
      ['configuration-readiness', 'pending'],
      ['worker-online', 'current'],
      ['first-success', 'pending'],
    ])
    expect(result.activated).toBe(false)
  })

  it('only reports activation after real readiness, worker, job and successful-run evidence', () => {
    const result = buildOnboardingChecklist({
      role: 'ROLE_ADMIN',
      evidence: evidence({
        jobDefinitionCount: 2,
        successfulRunCount: 1,
        onlineWorkerCount: 3,
        readiness: { tenantId: 'tenant-a', ready: true, blocking: [], warnings: [] },
      }),
    })

    expect(result.activated).toBe(true)
    expect(result.completedCount).toBe(result.totalCount)
  })

  it('does not expose configuration actions to tenant users', () => {
    const result = buildOnboardingChecklist({
      role: 'ROLE_TENANT_USER',
      evidence: evidence(),
    })

    expect(result.steps.map((step) => step.id)).toEqual([
      'tenant-context',
      'runnable-job',
      'first-success',
    ])
    expect(result.steps[1]).toMatchObject({ status: 'blocked', route: undefined })
  })

  it('uses a visit checkpoint only for the auditor learning step', () => {
    const before = buildOnboardingChecklist({
      role: 'ROLE_AUDITOR',
      evidence: evidence({ runCount: 1 }),
    })
    const after = buildOnboardingChecklist({
      role: 'ROLE_AUDITOR',
      evidence: evidence({ runCount: 1 }),
      visitedStepIds: ['audit-trail'],
    })

    expect(before.steps[2].status).toBe('current')
    expect(after.steps[2].status).toBe('completed')
  })

  it('keeps unavailable evidence distinct from incomplete work', () => {
    const result = buildOnboardingChecklist({
      role: 'ROLE_ADMIN',
      evidence: evidence({ jobDefinitionCount: null, onlineWorkerCount: null }),
    })

    expect(result.steps[1].status).toBe('unavailable')
    expect(result.steps[3].status).toBe('unavailable')
  })
})

describe('onboardingPreferenceKey', () => {
  it('isolates preferences by user and tenant', () => {
    expect(onboardingPreferenceKey('u1', 't1')).not.toBe(onboardingPreferenceKey('u1', 't2'))
    expect(onboardingPreferenceKey('u1', 't1')).not.toBe(onboardingPreferenceKey('u2', 't1'))
  })
})
