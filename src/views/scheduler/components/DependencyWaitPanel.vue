<template>
  <SectionCard v-if="canRead" class="dependency-waits" data-testid="dependency-waits-panel">
    <template #header>
      <div class="dependency-waits__header">
        <span>{{ t('dependencyWaits.title') }}</span>
        <span v-if="updatedAt" class="dependency-waits__updated">
          {{ t('dependencyWaits.updatedAt', { time: fmtDatetime(updatedAt) }) }}
        </span>
        <el-button :loading="loading" @click="loadActive">{{ t('common.refresh') }}</el-button>
      </div>
    </template>

    <el-alert
      v-if="!tenant.tenantId"
      :title="t('dependencyWaits.selectTenant')"
      type="info"
      :closable="false"
    />
    <template v-else>
      <el-tabs v-model="activeKind" @tab-change="onTabChange">
        <el-tab-pane :label="t('dependencyWaits.calendarTab')" name="calendar">
          <el-form inline class="dependency-waits__filters" @submit.prevent="loadCalendar">
            <el-form-item :label="t('dependencyWaits.calendarCode')">
              <el-input v-model="calendarCode" clearable maxlength="128" />
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.status')">
              <el-select v-model="calendarStatus" class="dependency-waits__status">
                <el-option
                  v-for="status in calendarStatuses"
                  :key="status"
                  :label="t(`dependencyWaits.states.${status}`)"
                  :value="status"
                />
              </el-select>
            </el-form-item>
            <el-button type="primary" :loading="calendarLoading" @click="loadCalendar">
              {{ t('common.search') }}
            </el-button>
          </el-form>
          <el-alert
            v-if="calendarError"
            :title="t('dependencyWaits.loadError')"
            type="error"
            :closable="false"
            show-icon
          />
          <CalendarDependencyWaitTable
            :waits="calendarWaits"
            :loading="calendarLoading"
            :can-write-system="canWriteSystem"
            :pending-action-id="pendingActionId"
            @request-action="requestAction"
          />
          <p class="dependency-waits__hint">{{ t('dependencyWaits.limitHint') }}</p>
        </el-tab-pane>

        <el-tab-pane :label="t('dependencyWaits.jobTab')" name="job">
          <el-form inline class="dependency-waits__filters" @submit.prevent="loadJobs">
            <el-form-item :label="t('dependencyWaits.jobCode')">
              <el-input v-model="jobCode" clearable maxlength="128" />
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.status')">
              <el-select v-model="jobStatus" class="dependency-waits__status">
                <el-option
                  v-for="status in jobStatuses"
                  :key="status"
                  :label="status ? t(`dependencyWaits.states.${status}`) : t('dependencyWaits.all')"
                  :value="status"
                />
              </el-select>
            </el-form-item>
            <el-button type="primary" :loading="jobLoading" @click="loadJobs">
              {{ t('common.search') }}
            </el-button>
          </el-form>
          <el-alert
            v-if="jobError"
            :title="t('dependencyWaits.loadError')"
            type="error"
            :closable="false"
            show-icon
          />
          <JobDependencyWaitTable :waits="jobWaits" :loading="jobLoading" />
          <p class="dependency-waits__hint">
            {{ t('dependencyWaits.noJobActionHint') }} {{ t('dependencyWaits.limitHint') }}
          </p>
        </el-tab-pane>

        <el-tab-pane :label="t('dependencyWaits.persistentTab')" name="persistent">
          <el-form
            inline
            class="dependency-waits__filters"
            @submit.prevent="loadPersistentWaits(true)"
          >
            <el-form-item :label="t('dependencyWaits.waitType')">
              <el-select v-model="persistentWaitType" clearable class="dependency-waits__status">
                <el-option :label="t('dependencyWaits.all')" value="" />
                <el-option
                  v-for="waitType in persistentWaitTypes"
                  :key="waitType"
                  :label="t(`dependencyWaits.waitTypes.${waitType}`)"
                  :value="waitType"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.workflowDefinitionId')">
              <el-input-number
                v-model="persistentWorkflowDefinitionId"
                :min="1"
                :precision="0"
                clearable
              />
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.status')">
              <el-select v-model="persistentWaitStatus" clearable class="dependency-waits__status">
                <el-option :label="t('dependencyWaits.all')" value="" />
                <el-option
                  v-for="status in persistentWaitStatuses"
                  :key="status"
                  :label="t(`dependencyWaits.states.${status}`)"
                  :value="status"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.fromDate')">
              <el-date-picker
                v-model="persistentBizDateFrom"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('dependencyWaits.fromDate')"
              />
            </el-form-item>
            <el-form-item :label="t('dependencyWaits.toDate')">
              <el-date-picker
                v-model="persistentBizDateTo"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('dependencyWaits.toDate')"
              />
            </el-form-item>
            <el-button
              type="primary"
              :loading="persistentLoading"
              @click="loadPersistentWaits(true)"
            >
              {{ t('common.search') }}
            </el-button>
          </el-form>
          <el-alert
            v-if="persistentError"
            :title="t('dependencyWaits.loadError')"
            type="error"
            :closable="false"
            show-icon
          />
          <PersistentWaitTable :waits="persistentWaits" :loading="persistentLoading" />
          <el-pagination
            v-model:current-page="persistentPageNo"
            v-model:page-size="persistentPageSize"
            class="dependency-waits__pagination"
            :page-sizes="[15, 30, 50, 100]"
            :total="persistentTotal"
            layout="total, sizes, prev, pager, next"
            @current-change="loadPersistentWaits()"
            @size-change="onPersistentPageSizeChange"
          />
          <p class="dependency-waits__hint">{{ t('dependencyWaits.persistentSafeHint') }}</p>
        </el-tab-pane>
      </el-tabs>
    </template>
  </SectionCard>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import {
    listCalendarDependencyWaits,
    listJobDependencyWaits,
    requestCalendarDependencyWaitAction,
    type CalendarDependencyWait,
    type JobDependencyWait,
  } from '@/api/dependencyWaits'
  import { listPersistentWaits, type PersistentWait } from '@/api/persistentWaits'
  import { usePermission } from '@/composables/usePermission'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { createIdempotencyKey } from '@/utils/idempotency'
  import { fmtDatetime } from '@/utils/datetime'
  import CalendarDependencyWaitTable from './dependency-waits/CalendarDependencyWaitTable.vue'
  import JobDependencyWaitTable from './dependency-waits/JobDependencyWaitTable.vue'
  import PersistentWaitTable from './dependency-waits/PersistentWaitTable.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { canRequestCalendarDependencyAction } from '../dependencyWaitsPresentation'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const actionScope = useTenantRequestScope()
  const { hasPermission, canWriteSystem } = usePermission()
  const canRead = computed(
    () =>
      hasPermission('ROLE_ADMIN') ||
      hasPermission('ROLE_AUDITOR') ||
      hasPermission('ROLE_TENANT_ADMIN'),
  )
  const activeKind = ref<'calendar' | 'job' | 'persistent'>('calendar')
  const calendarCode = ref('')
  const calendarStatus = ref<'WAITING' | 'OPENED' | 'SKIPPED'>('WAITING')
  const jobCode = ref('')
  const jobStatus = ref<'WAITING' | 'RELEASED' | 'CANCELLED' | ''>('WAITING')
  const calendarWaits = ref<CalendarDependencyWait[]>([])
  const jobWaits = ref<JobDependencyWait[]>([])
  const persistentWaits = ref<PersistentWait[]>([])
  const persistentWaitType = ref<PersistentWait['waitType'] | ''>('')
  const persistentWaitStatus = ref<PersistentWait['waitStatus'] | ''>('')
  const persistentWorkflowDefinitionId = ref<number | undefined>()
  const persistentBizDateFrom = ref('')
  const persistentBizDateTo = ref('')
  const persistentPageNo = ref(1)
  const persistentPageSize = ref(15)
  const persistentTotal = ref(0)
  const calendarLoading = ref(false)
  const jobLoading = ref(false)
  const persistentLoading = ref(false)
  const calendarError = ref(false)
  const jobError = ref(false)
  const persistentError = ref(false)
  const updatedAt = ref<string | null>(null)
  const pendingActionId = ref('')
  const loading = computed(
    () => calendarLoading.value || jobLoading.value || persistentLoading.value,
  )
  const calendarStatuses = ['WAITING', 'OPENED', 'SKIPPED'] as const
  const jobStatuses = ['WAITING', 'RELEASED', 'CANCELLED', ''] as const
  const persistentWaitTypes: PersistentWait['waitType'][] = ['READINESS', 'CAPACITY_ADMISSION']
  const persistentWaitStatuses: PersistentWait['waitStatus'][] = [
    'PENDING',
    'RELEASED',
    'TIMED_OUT',
    'CANCELLED',
    'WAITING',
    'RESUMED',
    'REJECTED',
  ]
  let calendarRequest = 0
  let jobRequest = 0
  let persistentRequest = 0

  watch(
    () => tenant.tenantId,
    () => {
      ++calendarRequest
      ++jobRequest
      ++persistentRequest
      pendingActionId.value = ''
      calendarWaits.value = []
      jobWaits.value = []
      persistentWaits.value = []
      persistentTotal.value = 0
      updatedAt.value = null
      calendarError.value = false
      jobError.value = false
      persistentError.value = false
      calendarLoading.value = false
      jobLoading.value = false
      persistentLoading.value = false
    },
    { flush: 'sync' },
  )
  watch(canRead, (allowed) => {
    if (allowed) return
    ++calendarRequest
    ++jobRequest
    ++persistentRequest
    calendarWaits.value = []
    jobWaits.value = []
    persistentWaits.value = []
    persistentTotal.value = 0
    updatedAt.value = null
    calendarLoading.value = false
    jobLoading.value = false
    persistentLoading.value = false
    persistentError.value = false
  })
  useTenantReload(loadActive)

  async function loadActive() {
    if (activeKind.value === 'calendar') await loadCalendar()
    else if (activeKind.value === 'job') await loadJobs()
    else await loadPersistentWaits()
  }

  async function loadCalendar() {
    const request = ++calendarRequest
    const tenantId = tenant.tenantId
    calendarWaits.value = []
    updatedAt.value = null
    calendarError.value = false
    if (!canRead.value || !tenantId) {
      calendarLoading.value = false
      return
    }
    calendarLoading.value = true
    try {
      const response = await listCalendarDependencyWaits({
        tenantId,
        calendarCode: calendarCode.value.trim() || undefined,
        waitStatus: calendarStatus.value,
        limit: 200,
      })
      if (request === calendarRequest && tenantId === tenant.tenantId && canRead.value) {
        calendarWaits.value = response
        updatedAt.value = new Date().toISOString()
      }
    } catch {
      if (request === calendarRequest && tenantId === tenant.tenantId && canRead.value)
        calendarError.value = true
    } finally {
      if (request === calendarRequest) calendarLoading.value = false
    }
  }

  async function loadJobs() {
    const request = ++jobRequest
    const tenantId = tenant.tenantId
    jobWaits.value = []
    updatedAt.value = null
    jobError.value = false
    if (!canRead.value || !tenantId) {
      jobLoading.value = false
      return
    }
    jobLoading.value = true
    try {
      const response = await listJobDependencyWaits({
        tenantId,
        jobCode: jobCode.value.trim() || undefined,
        waitStatus: jobStatus.value || undefined,
        limit: 200,
      })
      if (request === jobRequest && tenantId === tenant.tenantId && canRead.value) {
        jobWaits.value = response
        updatedAt.value = new Date().toISOString()
      }
    } catch {
      if (request === jobRequest && tenantId === tenant.tenantId && canRead.value)
        jobError.value = true
    } finally {
      if (request === jobRequest) jobLoading.value = false
    }
  }

  function onTabChange() {
    void loadActive()
  }

  async function loadPersistentWaits(resetPage = false) {
    if (resetPage) persistentPageNo.value = 1
    const request = ++persistentRequest
    const tenantId = tenant.tenantId
    persistentWaits.value = []
    persistentTotal.value = 0
    persistentError.value = false
    updatedAt.value = null
    if (!canRead.value || !tenantId) {
      persistentLoading.value = false
      return
    }
    persistentLoading.value = true
    try {
      const response = await listPersistentWaits({
        tenantId,
        waitType: persistentWaitType.value || undefined,
        waitStatus: persistentWaitStatus.value || undefined,
        workflowDefinitionId: persistentWorkflowDefinitionId.value,
        bizDateFrom: persistentBizDateFrom.value || undefined,
        bizDateTo: persistentBizDateTo.value || undefined,
        pageNo: persistentPageNo.value,
        pageSize: persistentPageSize.value,
      })
      if (request === persistentRequest && tenantId === tenant.tenantId && canRead.value) {
        persistentWaits.value = response.items
        persistentTotal.value = response.total
        updatedAt.value = new Date().toISOString()
      }
    } catch {
      if (request === persistentRequest && tenantId === tenant.tenantId && canRead.value)
        persistentError.value = true
    } finally {
      if (request === persistentRequest) persistentLoading.value = false
    }
  }

  function onPersistentPageSizeChange() {
    persistentPageNo.value = 1
    void loadPersistentWaits()
  }

  async function requestAction(wait: CalendarDependencyWait, action: 'RELEASE' | 'SKIP') {
    if (
      !canRead.value ||
      !canRequestCalendarDependencyAction(wait, canWriteSystem.value) ||
      wait.tenantId !== tenant.tenantId ||
      pendingActionId.value
    )
      return
    const scope = actionScope.begin()
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrentContext = () =>
      actionScope.isCurrent(scope) &&
      operator === (auth.userInfo?.username ?? auth.userInfo?.userId)
    const isCurrent = () =>
      isCurrentContext() &&
      canRead.value &&
      canRequestCalendarDependencyAction(wait, canWriteSystem.value) &&
      calendarWaits.value.some(
        (current) =>
          current.id === wait.id &&
          canRequestCalendarDependencyAction(current, canWriteSystem.value),
      )
    let reason: string
    try {
      const result = await ElMessageBox.prompt(
        t('dependencyWaits.reasonPrompt', { action: t(`dependencyWaits.actions.${action}`) }),
        t('dependencyWaits.reasonTitle'),
        {
          inputType: 'textarea',
          inputPlaceholder: t('dependencyWaits.reasonPlaceholder'),
          inputValidator: (value: string) => {
            const normalized = value.trim()
            if (!normalized) return t('dependencyWaits.reasonRequired')
            if (normalized.length > 1024) return t('dependencyWaits.reasonTooLong')
            return true
          },
          confirmButtonText: t('dependencyWaits.actions.' + action),
          cancelButtonText: t('common.cancel'),
        },
      )
      reason = result.value.trim()
    } catch {
      return
    }

    if (!isCurrent()) return
    const actionId = `${wait.id}:${action}`
    pendingActionId.value = actionId
    try {
      await requestCalendarDependencyWaitAction(
        {
          tenantId: wait.tenantId,
          calendarCode: wait.calendarCode,
          bizDate: wait.bizDate,
          action,
          reason,
        },
        createIdempotencyKey(),
      )
      if (!isCurrentContext()) return
      ElMessage.success(t('dependencyWaits.actionRecorded'))
      await loadCalendar()
    } catch {
      if (!isCurrentContext()) return
      ElMessage.error(t('dependencyWaits.actionError'))
      await loadCalendar()
    } finally {
      if (isCurrentContext()) pendingActionId.value = ''
    }
  }
</script>

<style scoped>
  .dependency-waits__header,
  .dependency-waits__filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .dependency-waits__header {
    justify-content: space-between;
    width: 100%;
  }

  .dependency-waits__updated,
  .dependency-waits__hint {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .dependency-waits__filters {
    margin-bottom: var(--space-md);
  }

  .dependency-waits__pagination {
    justify-content: flex-end;
    margin-top: var(--space-md);
  }

  .dependency-waits__status {
    min-width: 150px;
  }

  .dependency-waits__hint {
    margin-block: var(--space-sm) 0;
  }
</style>
