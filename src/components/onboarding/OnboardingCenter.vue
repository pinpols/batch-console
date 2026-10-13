<template>
  <SectionCard class="onboarding-center" data-onboarding="onboarding-center">
    <div v-if="collapsed" class="onboarding-center__compact">
      <div class="onboarding-center__compact-copy">
        <span class="onboarding-center__eyebrow">{{ t('onboardingCenter.eyebrow') }}</span>
        <strong>{{ compactTitle }}</strong>
        <span>{{ compactDescription }}</span>
      </div>
      <el-button type="primary" plain @click="setCollapsed(false)">
        {{ t('onboardingCenter.continue') }}
      </el-button>
    </div>

    <template v-else>
      <div class="onboarding-center__header">
        <div class="onboarding-center__heading">
          <span class="onboarding-center__eyebrow">{{ t('onboardingCenter.eyebrow') }}</span>
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
        <div class="onboarding-center__header-actions">
          <el-button :loading="loading" @click="load">
            {{ t('common.refresh') }}
          </el-button>
          <el-button @click="setCollapsed(true)">
            {{ t('onboardingCenter.remindLater') }}
          </el-button>
        </div>
      </div>

      <div class="onboarding-center__progress">
        <div class="onboarding-center__progress-copy">
          <span>
            {{
              t('onboardingCenter.progress', {
                completed: checklist.completedCount,
                total: checklist.totalCount,
              })
            }}
          </span>
          <strong>{{ progressPercentage }}%</strong>
        </div>
        <el-progress
          :percentage="progressPercentage"
          :show-text="false"
          :status="checklist.activated ? 'success' : undefined"
        />
      </div>

      <el-alert
        v-if="evidence.failedSources.length"
        class="onboarding-center__partial"
        type="warning"
        :closable="false"
        show-icon
        :title="t('onboardingCenter.partialFailure')"
      />

      <div v-if="checklist.activated" class="onboarding-center__success" role="status">
        <el-icon aria-hidden="true"><CircleCheck /></el-icon>
        <div>
          <strong>{{ t('onboardingCenter.completedTitle') }}</strong>
          <p>{{ t('onboardingCenter.completedDescription') }}</p>
        </div>
      </div>

      <ol class="onboarding-center__steps">
        <li
          v-for="(step, index) in checklist.steps"
          :key="step.id"
          class="onboarding-step"
          :class="`is-${step.status}`"
        >
          <div class="onboarding-step__marker" aria-hidden="true">
            <el-icon v-if="step.status === 'completed'"><Check /></el-icon>
            <el-icon v-else-if="step.status === 'blocked'"><TriangleAlert /></el-icon>
            <el-icon v-else-if="step.status === 'pending'"><Lock /></el-icon>
            <el-icon v-else-if="step.status === 'unavailable'"><CloudOff /></el-icon>
            <span v-else>{{ index + 1 }}</span>
          </div>

          <div class="onboarding-step__body">
            <div class="onboarding-step__copy">
              <div class="onboarding-step__title-row">
                <h3>{{ stepTitle(step) }}</h3>
                <el-tag :type="statusType(step.status)" size="small" effect="plain">
                  {{ t(`onboardingCenter.status.${step.status}`) }}
                </el-tag>
              </div>
              <p>{{ stepDescription(step) }}</p>

              <div
                v-if="step.blockingItems?.length"
                class="onboarding-step__blockers"
                role="status"
              >
                <strong>
                  {{ t('onboardingCenter.blockers', { count: step.blockingItems.length }) }}
                </strong>
                <ul>
                  <li v-for="item in step.blockingItems.slice(0, 3)" :key="blockerKey(item)">
                    <span>{{ item.ref || item.item }}</span>
                    <span>{{ item.hint || item.reason }}</span>
                  </li>
                </ul>
                <span v-if="step.blockingItems.length > 3" class="onboarding-step__more">
                  {{ t('onboardingCenter.moreBlockers', { count: step.blockingItems.length - 3 }) }}
                </span>
              </div>
            </div>

            <div class="onboarding-step__actions">
              <el-button v-if="step.docKey" text @click="openDocs(step)">
                <el-icon><BookOpen /></el-icon>
                {{ t('onboardingCenter.viewGuide') }}
              </el-button>
              <el-button
                v-if="step.secondaryRoute"
                @click="go(step, step.secondaryRoute, 'secondary')"
              >
                {{ t('onboardingCenter.importConfig') }}
              </el-button>
              <el-button
                v-if="step.route && step.status !== 'pending'"
                :type="
                  step.status === 'current' || step.status === 'blocked' ? 'primary' : 'default'
                "
                @click="go(step, step.route, 'primary')"
              >
                {{ stepAction(step) }}
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </li>
      </ol>
    </template>
  </SectionCard>

  <DocsDrawer v-model="docsOpen" :doc-key="activeDocKey" />
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    ArrowRight,
    BookOpen,
    Check,
    CircleCheck,
    CloudOff,
    Lock,
    TriangleAlert,
  } from '@lucide/vue'
  import DocsDrawer from '@/components/common/DocsDrawer.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { useOnboardingChecklist } from '@/composables/useOnboardingChecklist'
  import type { OnboardingStep, OnboardingStepStatus } from '@/composables/onboardingModel'
  import type { TenantReadinessResult } from '@/api/tenants'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const {
    role,
    evidence,
    checklist,
    loading,
    collapsed,
    progressPercentage,
    load,
    setCollapsed,
    trackStepAction,
  } = useOnboardingChecklist()
  const docsOpen = ref(false)
  const activeDocKey = ref('first-tenant-config-quickstart')

  const roleKey = computed(() => {
    if (role.value === 'ROLE_ADMIN') return 'admin'
    if (role.value === 'ROLE_AUDITOR') return 'auditor'
    if (role.value === 'ROLE_TENANT_ADMIN') return 'tenantAdmin'
    return 'tenantUser'
  })
  const title = computed(() => t(`onboardingCenter.role.${roleKey.value}.title`))
  const description = computed(() => t(`onboardingCenter.role.${roleKey.value}.description`))
  const compactTitle = computed(() =>
    checklist.value.activated ? t('onboardingCenter.completedTitle') : title.value,
  )
  const compactDescription = computed(() =>
    t('onboardingCenter.progress', {
      completed: checklist.value.completedCount,
      total: checklist.value.totalCount,
    }),
  )

  function stepTitle(step: OnboardingStep) {
    return t(`onboardingCenter.step.${step.id}.title`)
  }

  function stepDescription(step: OnboardingStep) {
    if (step.status === 'blocked' && !step.route) {
      return t(`onboardingCenter.step.${step.id}.blockedDescription`)
    }
    return t(`onboardingCenter.step.${step.id}.description`)
  }

  function stepAction(step: OnboardingStep) {
    return t(`onboardingCenter.step.${step.id}.action`)
  }

  function statusType(status: OnboardingStepStatus) {
    if (status === 'completed') return 'success'
    if (status === 'blocked') return 'warning'
    if (status === 'current') return 'primary'
    if (status === 'unavailable') return 'warning'
    return 'info'
  }

  function blockerKey(item: TenantReadinessResult['blocking'][number]) {
    return `${item.item}:${item.ref}:${item.reason}`
  }

  function go(step: OnboardingStep, path: string, action: 'primary' | 'secondary') {
    trackStepAction(step, action)
    void router.push(path)
  }

  function openDocs(step: OnboardingStep) {
    if (!step.docKey) return
    trackStepAction(step, 'docs')
    activeDocKey.value = step.docKey
    docsOpen.value = true
  }
</script>

<style scoped>
  .onboarding-center {
    margin-bottom: var(--space-lg);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border-light));
  }

  .onboarding-center__header,
  .onboarding-center__compact,
  .onboarding-step__body,
  .onboarding-step__title-row,
  .onboarding-center__progress-copy {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .onboarding-center__heading {
    min-width: 0;
  }

  .onboarding-center__eyebrow {
    display: block;
    margin-bottom: var(--space-xs);
    color: var(--color-primary);
    font-size: var(--font-size-xs);
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .onboarding-center__heading h2 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-lg);
    line-height: var(--line-height-tight);
  }

  .onboarding-center__heading p,
  .onboarding-center__success p,
  .onboarding-step__copy p {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-base);
  }

  .onboarding-center__header-actions,
  .onboarding-step__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .onboarding-center__progress {
    margin-top: var(--space-lg);
  }

  .onboarding-center__progress-copy {
    margin-bottom: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .onboarding-center__partial,
  .onboarding-center__success {
    margin-top: var(--space-md);
  }

  .onboarding-center__success {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-radius: var(--radius-content);
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
  }

  .onboarding-center__success p {
    color: var(--color-text-secondary);
  }

  .onboarding-center__steps {
    display: grid;
    gap: 0;
    margin: var(--space-lg) 0 0;
    padding: 0;
    list-style: none;
  }

  .onboarding-step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: var(--space-md);
    padding: var(--space-md) 0;
    border-top: 1px solid var(--color-border-light);
  }

  .onboarding-step__marker {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    color: var(--color-text-secondary);
    background: var(--color-bg-elevated);
    font-size: var(--font-size-sm);
    font-weight: 650;
  }

  .onboarding-step.is-completed .onboarding-step__marker {
    border-color: var(--color-success);
    color: var(--button-primary-text);
    background: var(--color-success);
  }

  .onboarding-step.is-current .onboarding-step__marker {
    border-color: var(--color-primary);
    color: var(--button-primary-text);
    background: var(--color-primary);
  }

  .onboarding-step.is-blocked .onboarding-step__marker {
    border-color: var(--color-warning);
    color: var(--color-warning);
  }

  .onboarding-step__body {
    align-items: flex-start;
    min-width: 0;
  }

  .onboarding-step__copy {
    flex: 1;
    min-width: 0;
  }

  .onboarding-step__title-row {
    justify-content: flex-start;
    gap: var(--space-sm);
  }

  .onboarding-step__title-row h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
  }

  .onboarding-step__blockers {
    margin-top: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-left: 3px solid var(--color-warning);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--color-warning) 7%, transparent);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
  }

  .onboarding-step__blockers ul {
    display: grid;
    gap: var(--space-xs);
    margin: var(--space-xs) 0 0;
    padding-left: var(--space-lg);
  }

  .onboarding-step__blockers li span:first-child {
    margin-right: var(--space-xs);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .onboarding-step__more {
    display: block;
    margin-top: var(--space-xs);
  }

  .onboarding-center__compact-copy {
    display: grid;
    min-width: 0;
  }

  .onboarding-center__compact-copy span:last-child {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  @media (max-width: 900px) {
    .onboarding-center__header,
    .onboarding-center__compact,
    .onboarding-step__body {
      align-items: stretch;
      flex-direction: column;
    }

    .onboarding-center__header-actions,
    .onboarding-step__actions {
      justify-content: flex-start;
    }
  }
</style>
