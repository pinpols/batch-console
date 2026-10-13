import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOnboardingEvidence } from '@/api/onboarding'
import { resolveAuthorityRole } from '@/constants/role'
import { useAuthStore } from '@/stores/auth'
import { useTenantStore } from '@/stores/tenant'
import { logClick, logError } from '@/utils/logger'
import { useTenantReload } from '@/composables/useTenantReload'
import {
  buildOnboardingChecklist,
  onboardingPreferenceKey,
  type OnboardingEvidence,
  type OnboardingStep,
} from './onboardingModel'

interface OnboardingPreferences {
  collapsed: boolean
  visitedStepIds: string[]
}

const EMPTY_PREFERENCES: OnboardingPreferences = {
  collapsed: false,
  visitedStepIds: [],
}

function emptyEvidence(tenantId: string): OnboardingEvidence {
  return {
    tenantId,
    jobDefinitionCount: null,
    runCount: null,
    successfulRunCount: null,
    onlineWorkerCount: null,
    readiness: null,
    readinessSupported: false,
    failedSources: [],
  }
}

function readPreferences(key: string): OnboardingPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<OnboardingPreferences>
    return {
      collapsed: value.collapsed === true,
      visitedStepIds: Array.isArray(value.visitedStepIds)
        ? value.visitedStepIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return { ...EMPTY_PREFERENCES }
  }
}

export function useOnboardingChecklist() {
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const route = useRoute()
  const role = computed(() => resolveAuthorityRole(auth.userInfo?.permissions ?? []))
  const preferenceKey = computed(() =>
    onboardingPreferenceKey(auth.userInfo?.userId ?? '', tenant.tenantId),
  )
  const preferences = ref<OnboardingPreferences>({ ...EMPTY_PREFERENCES })
  const evidence = ref<OnboardingEvidence>(emptyEvidence(tenant.tenantId))
  const loading = ref(false)
  let loadSequence = 0

  const checklist = computed(() =>
    buildOnboardingChecklist({
      role: role.value,
      evidence: evidence.value,
      visitedStepIds: preferences.value.visitedStepIds,
    }),
  )

  const progressPercentage = computed(() =>
    checklist.value.totalCount === 0
      ? 0
      : Math.round((checklist.value.completedCount / checklist.value.totalCount) * 100),
  )

  function savePreferences(next: OnboardingPreferences) {
    preferences.value = next
    localStorage.setItem(preferenceKey.value, JSON.stringify(next))
  }

  function setCollapsed(collapsed: boolean) {
    savePreferences({ ...preferences.value, collapsed })
    logClick(collapsed ? 'onboarding:center_collapsed' : 'onboarding:center_expanded', {
      tenantId: tenant.tenantId,
      role: role.value,
    })
  }

  function markStepVisited(step: OnboardingStep) {
    if (step.completion !== 'visit' || preferences.value.visitedStepIds.includes(step.id)) return
    savePreferences({
      ...preferences.value,
      visitedStepIds: [...preferences.value.visitedStepIds, step.id],
    })
  }

  function trackStepAction(step: OnboardingStep, action: 'primary' | 'secondary' | 'docs') {
    markStepVisited(step)
    logClick('onboarding:step_action', {
      stepId: step.id,
      action,
      status: step.status,
      tenantId: tenant.tenantId,
      role: role.value,
    })
  }

  async function load() {
    const requestedTenantId = tenant.tenantId
    const requestedRole = role.value
    const sequence = ++loadSequence
    if (!requestedTenantId) {
      evidence.value = emptyEvidence('')
      loading.value = false
      return
    }

    loading.value = true
    try {
      const next = await getOnboardingEvidence(requestedTenantId, {
        includeReadiness: requestedRole === 'ROLE_ADMIN' || requestedRole === 'ROLE_TENANT_ADMIN',
      })
      if (sequence !== loadSequence || tenant.tenantId !== requestedTenantId) return
      evidence.value = next
      if (next.failedSources.length) {
        logError('onboarding:evidence_partial_failure', {
          tenantId: requestedTenantId,
          sources: next.failedSources,
        })
      }
    } catch (error) {
      if (sequence !== loadSequence || tenant.tenantId !== requestedTenantId) return
      evidence.value = emptyEvidence(requestedTenantId)
      logError('onboarding:evidence_load_failed', {
        tenantId: requestedTenantId,
        reason: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  watch(
    preferenceKey,
    (key) => {
      preferences.value = readPreferences(key)
    },
    { immediate: true },
  )

  watch(role, (current, previous) => {
    if (current && current !== previous && tenant.tenantId) void load()
  })

  watch(
    () => route.fullPath,
    () => {
      if (route.path === '/ops/summary' && tenant.tenantId) void load()
    },
  )

  watch(
    () => route.query.onboarding,
    (requested) => {
      if (requested === '1' && preferences.value.collapsed) setCollapsed(false)
    },
    { immediate: true },
  )

  useTenantReload(load)

  return {
    role,
    evidence,
    checklist,
    loading,
    collapsed: computed(() => preferences.value.collapsed),
    progressPercentage,
    load,
    setCollapsed,
    trackStepAction,
  }
}
