import type { AuthorityRole } from '@/constants/role'
import type { TenantReadinessResult } from '@/api/tenants'

export const ONBOARDING_GUIDE_VERSION = '2026-10-v2'

export type OnboardingStepStatus = 'completed' | 'current' | 'blocked' | 'pending' | 'unavailable'

export type OnboardingStepId =
  | 'tenant-context'
  | 'job-config'
  | 'configuration-readiness'
  | 'worker-online'
  | 'first-success'
  | 'runnable-job'
  | 'inspect-run'
  | 'audit-trail'

export interface OnboardingEvidence {
  tenantId: string
  jobDefinitionCount: number | null
  runCount: number | null
  successfulRunCount: number | null
  onlineWorkerCount: number | null
  readiness: TenantReadinessResult | null
  readinessSupported: boolean
  failedSources: string[]
}

export interface OnboardingStep {
  id: OnboardingStepId
  status: OnboardingStepStatus
  route?: string
  secondaryRoute?: string
  docKey?: string
  completion?: 'evidence' | 'visit'
  blockingItems?: TenantReadinessResult['blocking']
}

export interface OnboardingChecklist {
  steps: OnboardingStep[]
  completedCount: number
  totalCount: number
  activated: boolean
}

export interface BuildOnboardingChecklistInput {
  role?: AuthorityRole
  evidence: OnboardingEvidence
  visitedStepIds?: string[]
}

function evidenceStatus(value: number | null, completedWhen: (value: number) => boolean) {
  if (value == null) return 'unavailable' as const
  return completedWhen(value) ? ('completed' as const) : ('current' as const)
}

function tenantStep(tenantId: string, canCreateTenant: boolean): OnboardingStep {
  if (tenantId) return { id: 'tenant-context', status: 'completed', completion: 'evidence' }
  return {
    id: 'tenant-context',
    status: canCreateTenant ? 'current' : 'blocked',
    route: canCreateTenant ? '/system/tenants' : undefined,
    completion: 'evidence',
  }
}

function prerequisiteStatus(prerequisitesComplete: boolean): OnboardingStepStatus {
  return prerequisitesComplete ? 'current' : 'pending'
}

function buildConfigurationSteps(
  role: 'ROLE_ADMIN' | 'ROLE_TENANT_ADMIN',
  evidence: OnboardingEvidence,
): OnboardingStep[] {
  const hasTenant = Boolean(evidence.tenantId)
  const jobStatus = hasTenant
    ? evidenceStatus(evidence.jobDefinitionCount, (count) => count > 0)
    : 'pending'
  const hasJob = evidence.jobDefinitionCount != null && evidence.jobDefinitionCount > 0

  let readinessStatus: OnboardingStepStatus = 'pending'
  if (hasJob) {
    readinessStatus = evidence.readinessSupported
      ? evidence.readiness == null
        ? 'unavailable'
        : evidence.readiness.ready
          ? 'completed'
          : 'blocked'
      : 'unavailable'
  }

  const workerStatus = hasTenant
    ? evidenceStatus(evidence.onlineWorkerCount, (count) => count > 0)
    : 'pending'
  const workerReady = evidence.onlineWorkerCount != null && evidence.onlineWorkerCount > 0
  const readinessReady = evidence.readiness?.ready === true
  const canRun = hasJob && readinessReady && workerReady
  const successStatus =
    evidence.successfulRunCount == null
      ? 'unavailable'
      : evidence.successfulRunCount > 0
        ? 'completed'
        : prerequisiteStatus(canRun)

  return [
    tenantStep(evidence.tenantId, role === 'ROLE_ADMIN'),
    {
      id: 'job-config',
      status: jobStatus,
      route: '/jobs/definitions/new',
      secondaryRoute: '/config/tenant-package',
      docKey: 'first-tenant-config-quickstart',
      completion: 'evidence',
    },
    {
      id: 'configuration-readiness',
      status: readinessStatus,
      route: '/config/tenant-package',
      docKey: 'first-tenant-config-quickstart',
      completion: 'evidence',
      blockingItems: evidence.readiness?.blocking ?? [],
    },
    {
      id: 'worker-online',
      status: workerStatus,
      route: role === 'ROLE_TENANT_ADMIN' ? '/workers/my-workers' : '/workers/management',
      docKey: 'worker-sdk-onboarding',
      completion: 'evidence',
    },
    {
      id: 'first-success',
      status: successStatus,
      route: hasJob ? '/jobs/definitions' : '/jobs/definitions/new',
      completion: 'evidence',
    },
  ]
}

function buildTenantUserSteps(evidence: OnboardingEvidence): OnboardingStep[] {
  const hasTenant = Boolean(evidence.tenantId)
  const jobStatus = hasTenant
    ? evidenceStatus(evidence.jobDefinitionCount, (count) => count > 0)
    : 'blocked'
  const hasJob = evidence.jobDefinitionCount != null && evidence.jobDefinitionCount > 0
  const successStatus =
    evidence.successfulRunCount == null
      ? 'unavailable'
      : evidence.successfulRunCount > 0
        ? 'completed'
        : prerequisiteStatus(hasJob)

  return [
    tenantStep(evidence.tenantId, false),
    {
      id: 'runnable-job',
      status: jobStatus === 'current' ? 'blocked' : jobStatus,
      route: hasJob ? '/jobs/definitions' : undefined,
      completion: 'evidence',
    },
    {
      id: 'first-success',
      status: successStatus,
      route: hasJob ? '/jobs/definitions' : undefined,
      completion: 'evidence',
    },
  ]
}

function buildAuditorSteps(
  evidence: OnboardingEvidence,
  visitedStepIds: string[],
): OnboardingStep[] {
  const hasTenant = Boolean(evidence.tenantId)
  const hasRun = evidence.runCount != null && evidence.runCount > 0
  const runStatus = hasTenant ? evidenceStatus(evidence.runCount, (count) => count > 0) : 'blocked'

  return [
    tenantStep(evidence.tenantId, false),
    {
      id: 'inspect-run',
      status: runStatus,
      route: '/monitor/job-instances',
      completion: 'evidence',
    },
    {
      id: 'audit-trail',
      status: visitedStepIds.includes('audit-trail') ? 'completed' : hasRun ? 'current' : 'pending',
      route: '/observability/operation-audits',
      completion: 'visit',
    },
  ]
}

export function buildOnboardingChecklist({
  role,
  evidence,
  visitedStepIds = [],
}: BuildOnboardingChecklistInput): OnboardingChecklist {
  const steps =
    role === 'ROLE_ADMIN' || role === 'ROLE_TENANT_ADMIN'
      ? buildConfigurationSteps(role, evidence)
      : role === 'ROLE_AUDITOR'
        ? buildAuditorSteps(evidence, visitedStepIds)
        : buildTenantUserSteps(evidence)
  const completedCount = steps.filter((step) => step.status === 'completed').length

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    activated: completedCount === steps.length,
  }
}

export function onboardingPreferenceKey(userId: string, tenantId: string): string {
  const identity = `${userId || 'anonymous'}:${tenantId || 'no-tenant'}`
  return `batch-console:onboarding:${ONBOARDING_GUIDE_VERSION}:${encodeURIComponent(identity)}`
}
