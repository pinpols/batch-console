<template>
  <PageContainer>
    <PageHeader
      :title="title"
      :description="t('batchDayWindow.description')"
      back-to="/scheduler/batch-days"
    >
      <template #actions>
        <el-button
          v-if="canReadGovernance"
          :disabled="!calendarCode"
          @click="governanceVisible = true"
          >{{ t('batchDayGovernance.title') }}</el-button
        >
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading || refresh.loading.value"
          @click="refresh.run(load)"
        >
          {{ t('batchDayWindow.refresh') }}
        </el-button>
        <el-button
          v-if="canManageSystem"
          type="success"
          :disabled="!calendarCode || writesFrozen || recoveryBlocked || Boolean(recoveryKey)"
          @click="openCatchup"
        >
          {{ t('batchDayWindow.catchUp') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard v-if="canManageSystem && (recoveryKey || recoveryBlocked)">
      <template #header>{{ t('batchDayWindow.recoveryTitle') }}</template>
      <p v-if="recoveryBlocked">{{ t('batchDayWindow.recoveryStorageError') }}</p>
      <template v-else>
        <p>{{ t('batchDayWindow.recoveryKey', { key: recoveryKey }) }}</p>
        <p v-if="recoveryStatus && !recoveryStatus.found">
          {{ t('batchDayWindow.recoveryNotFound') }}
        </p>
        <template v-else-if="recoveryStatus">
          <p>{{ t('batchDayWindow.recoveryState', { status: recoveryStatus.operationStatus }) }}</p>
          <p v-for="item in recoveryStatus.items" :key="item.jobCode">
            {{ item.jobCode }} · {{ item.status
            }}<span v-if="item.referenceNo"> · {{ item.referenceNo }}</span>
            <el-button
              v-if="['UNKNOWN', 'IN_FLIGHT'].includes(item.status)"
              :disabled="
                writesFrozen ||
                recoveryLoading ||
                reconcileLoading ||
                continueLoading ||
                abandonLoading
              "
              @click="reconcileCatchUp(item.jobCode)"
              >{{
                t(
                  recoveryStatus.catchUpPolicy === 'AUTO'
                    ? 'batchDayWindow.recoveryVerifyTrigger'
                    : 'batchDayWindow.recoveryReconcile',
                )
              }}</el-button
            >
          </p>
        </template>
        <p v-else>{{ t('batchDayWindow.recoveryUnknown') }}</p>
        <el-button :loading="recoveryLoading" @click="refreshCatchUpStatus">{{
          t('batchDayWindow.recoveryRefresh')
        }}</el-button>
        <el-button
          v-if="recoveryStatus && !recoveryStatus.found"
          :disabled="
            writesFrozen || recoveryLoading || reconcileLoading || continueLoading || abandonLoading
          "
          :loading="abandonLoading"
          @click="abandonUnpreparedCatchUp"
          >{{ t('batchDayWindow.recoveryAbandon') }}</el-button
        >
        <el-button
          v-if="canContinueCatchUp"
          :disabled="
            writesFrozen || recoveryLoading || reconcileLoading || continueLoading || abandonLoading
          "
          :loading="continueLoading"
          @click="continueCatchUp"
          >{{ t('batchDayWindow.recoveryContinue') }}</el-button
        >
        <el-button
          v-if="
            recoveryStatus?.found &&
            ['COMPLETE', 'ABANDONED'].includes(recoveryStatus.operationStatus ?? '')
          "
          @click="acknowledgeCatchUp"
          >{{ t('batchDayWindow.recoveryAcknowledge') }}</el-button
        >
      </template>
    </SectionCard>

    <div class="batch-day-context" role="search">
      <div class="batch-day-context__field">
        <span>{{ t('batchDayWindow.queryBizDate') }}</span>
        <el-date-picker
          v-model="bizDateDraft"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('batchDayWindow.queryBizDatePlaceholder')"
        />
      </div>
      <div class="batch-day-context__field">
        <span>{{ t('batchDayWindow.queryCalendar') }}</span>
        <el-select
          v-model="calendarDraft"
          filterable
          allow-create
          default-first-option
          :placeholder="t('batchDayWindow.selectCalendarPlaceholder')"
        >
          <el-option label="DEFAULT" value="DEFAULT" />
        </el-select>
      </div>
      <el-button type="primary" :loading="loading" @click="applyWindowQuery">
        {{ t('batchDayWindow.loadCalendar') }}
      </el-button>
    </div>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.windowStatus') }}</template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('batchDayWindow.bizDate')">
          {{ window.bizDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.dayStatus')">
          {{ window.dayStatus }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.currentTime')">
          <DatetimeText :value="window.currentSystemTime" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.cutoff')">
          <DatetimeText :value="window.cutoffAt" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.slaCutoff')">
          <DatetimeText :value="window.slaDeadlineAt" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.secondsToCutoff')">
          {{ window.timeUntilCutoffSeconds ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayWindow.lateWindowClosed')">
          <DatetimeText :value="window.lateArrivalWindowClosesAt" />
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.jobSummary') }}</template>
      <ListPageQueryBar
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="() => runSearch(() => {})"
        @reset="
          () =>
            runReset(() => {
              jobKeyword = ''
            })
        "
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('batchDayWindow.colJob')">
          <el-input
            class="query-w-240"
            v-model="jobKeyword"
            clearable
            :placeholder="t('batchDayWindow.jobSearchPlaceholder')"
          />
        </el-form-item>
      </ListPageQueryBar>
      <el-table
        :data="filteredJobs"
        stripe
        border
        :empty-text="t('common.noData')"
        class="console-table"
      >
        <el-table-column prop="jobCode" :label="t('batchDayWindow.colJob')" min-width="160">
          <template #default="{ row }">
            <router-link
              v-if="row.jobCode"
              class="cell-link"
              :to="`/monitor/job-instances?jobCode=${row.jobCode}&startDate=${bizDate}&endDate=${bizDate}`"
            >
              {{ row.jobCode }}
            </router-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="totalJobCount" :label="t('batchDayWindow.colTotalJob')" width="72" />
        <el-table-column
          prop="successJobCount"
          :label="t('batchDayWindow.colSuccessJob')"
          width="72"
        />
        <el-table-column
          prop="failedJobCount"
          :label="t('batchDayWindow.colFailedJob')"
          width="72"
        />
        <el-table-column
          prop="inFlightJobCount"
          :label="t('batchDayWindow.colInFlightJob')"
          width="88"
        />
        <el-table-column
          prop="catchupCount"
          :label="t('batchDayWindow.colCatchupJob')"
          width="88"
        />
      </el-table>
    </SectionCard>

    <SectionCard v-if="window">
      <template #header>{{ t('batchDayWindow.scheduledOccurrences') }}</template>
      <el-table
        :data="window.scheduledOccurrences"
        stripe
        border
        :empty-text="t('batchDayWindow.noScheduledOccurrences')"
        class="console-table"
      >
        <el-table-column
          prop="workflowCode"
          :label="t('batchDayWindow.colWorkflow')"
          min-width="180"
        />
        <el-table-column
          prop="scheduleVersion"
          :label="t('batchDayWindow.colScheduleVersion')"
          width="100"
        />
        <el-table-column
          prop="scheduledFireTime"
          :label="t('batchDayWindow.colScheduledFire')"
          min-width="190"
        >
          <template #default="{ row }">
            <DatetimeText :value="row.scheduledFireTime" />
          </template>
        </el-table-column>
        <el-table-column
          prop="occurrenceStatus"
          :label="t('batchDayWindow.colOccurrenceStatus')"
          min-width="170"
        >
          <template #default="{ row }">
            <el-tag :type="row.occurrenceStatus === 'CLOSED_DAY_REJECTED' ? 'danger' : 'info'">
              {{ occurrenceStatusLabel(row.occurrenceStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestId" :label="t('batchDayWindow.colRequestId')" min-width="180">
          <template #default="{ row }">{{ row.requestId || '—' }}</template>
        </el-table-column>
        <el-table-column
          prop="lastRejectionReason"
          :label="t('batchDayWindow.colRejectionReason')"
          min-width="260"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ row.lastRejectionReason || '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('batchDayWindow.occurrenceAction')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="
                canOfferOccurrenceCatchUp(
                  row as ConsoleBatchDayWindowResponse['scheduledOccurrences'][number],
                )
              "
              link
              type="primary"
              :disabled="writesFrozen"
              @click="
                openOccurrenceCatchUp(
                  row as ConsoleBatchDayWindowResponse['scheduledOccurrences'][number],
                )
              "
            >
              {{ t('batchDayWindow.occurrenceCatchUp') }}
            </el-button>
            <span v-else-if="row.occurrenceStatus === 'CLOSED_DAY_REJECTED'" class="text-muted">
              {{ t('batchDayWindow.occurrenceApprovalRequired') }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <SectionCard v-else-if="!loading && !calendarCode">
      <EmptyState
        :title="t('batchDayWindow.selectCalendarTitle')"
        :description="t('batchDayWindow.selectCalendarDescription')"
      />
    </SectionCard>

    <SectionCard v-else-if="!loading">
      <EmptyState :description="t('batchDayWindow.emptyDescription')" />
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="catchupVisible"
      :title="t('batchDayWindow.dialogTitle')"
      direction="rtl"
      size="480px"
      @closed="resetCatchup"
    >
      <el-form label-width="88px">
        <el-form-item :label="t('batchDayWindow.fieldCalendar')">
          <el-input v-model="catchupForm.calendarCode" disabled />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.fieldJobCodes')">
          <el-input
            v-model="catchupJobCodesText"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayWindow.fieldJobCodesPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.fieldReason')">
          <el-input
            v-model="catchupForm.reason"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayWindow.fieldReasonPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catchupVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="catchupLoading"
          :disabled="writesFrozen || recoveryBlocked || Boolean(recoveryKey)"
          @click="submitCatchup"
        >
          {{ t('batchDayWindow.dialogSubmit') }}
        </el-button>
      </template>
    </el-drawer>

    <el-dialog
      v-model="occurrenceCatchUpVisible"
      :title="t('batchDayWindow.occurrenceCatchUpTitle')"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <el-form-item :label="t('batchDayWindow.colWorkflow')">
          <el-input :model-value="selectedOccurrence?.occurrence.workflowCode" disabled />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.colScheduledFire')">
          <el-input :model-value="selectedOccurrence?.occurrence.scheduledFireTime" disabled />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.bizDate')">
          <el-input :model-value="selectedOccurrence?.occurrence.bizDate" disabled />
        </el-form-item>
        <el-form-item :label="t('batchDayWindow.occurrenceCatchUpReason')" required>
          <el-input
            v-model="occurrenceCatchUpReason"
            type="textarea"
            :rows="3"
            maxlength="1024"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="occurrenceCatchUpVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="occurrenceCatchUpLoading"
          :disabled="writesFrozen || !occurrenceCatchUpReason.trim()"
          @click="submitOccurrenceCatchUp"
        >
          {{ t('batchDayWindow.occurrenceCatchUpConfirm') }}
        </el-button>
      </template>
    </el-dialog>
    <BatchDayGovernanceDrawer
      v-if="canReadGovernance"
      v-model="governanceVisible"
      :calendar-code="calendarCode"
      :biz-date="bizDate"
      @changed="load"
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import BatchDayGovernanceDrawer from './components/BatchDayGovernanceDrawer.vue'
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'
  import { usePermission } from '@/composables/usePermission'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { workflowApi } from '@/api/workflow'

  const refresh = useRefreshAction()
  const { canManageSystem, canMutateConfig, hasPermission } = usePermission()
  const { writesFrozen } = useWriteAvailability()

  const { t } = useI18n({ useScope: 'global' })
  import {
    abandonUnpreparedBatchDayCatchUp,
    continueBatchDayCatchUpRequest,
    getBatchDayCatchUpRequestStatus,
    launchBatchDayCatchUp,
    queryBatchDayWindow,
    reconcileBatchDayCatchUpRequest,
  } from '@/api/batchDays'
  import { useAuthStore } from '@/stores/auth'
  import { STORAGE_KEYS } from '@/constants/storageKeys'
  import { createIdempotencyKey } from '@/utils/idempotency'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import DatetimeText from '@/components/common/DatetimeText.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleBatchDayWindowResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const governanceVisible = ref(false)
  const canReadGovernance = computed(() =>
    ['ROLE_ADMIN', 'ROLE_AUDITOR', 'ROLE_TENANT_ADMIN'].some(hasPermission),
  )

  const bizDate = computed(() => (route.params.bizDate as string) || '')
  const calendarCode = computed(() => (route.query.calendarCode as string) || '')
  const bizDateDraft = ref(bizDate.value)
  const calendarDraft = ref(calendarCode.value || 'DEFAULT')

  const title = computed(() =>
    bizDate.value
      ? t('batchDayWindow.titleWithDate', { date: bizDate.value })
      : t('batchDayWindow.titleDefault'),
  )

  const loading = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loading)
  const window = ref<ConsoleBatchDayWindowResponse | null>(null)
  const jobKeyword = ref('')

  const filteredJobs = computed(() => {
    const list = window.value?.jobs ?? []
    const trimmedKeyword = jobKeyword.value.trim()
    const k = trimmedKeyword.toLowerCase()
    if (!k) return list
    return list.filter((job) => {
      const jobCodeText = String(job.jobCode ?? '')
      const normalizedJobCode = jobCodeText.toLowerCase()
      return normalizedJobCode.includes(k)
    })
  })

  function occurrenceStatusLabel(status: string) {
    return t(`batchDayWindow.occurrenceStatuses.${status}`)
  }

  type CatchUpStatus = Awaited<ReturnType<typeof getBatchDayCatchUpRequestStatus>>
  const recoveryKey = ref('')
  const recoveryStatus = ref<CatchUpStatus | null>(null)
  const recoveryBlocked = ref(false)
  const recoveryLoading = ref(false)
  const reconcileLoading = ref(false)
  const continueLoading = ref(false)
  const abandonLoading = ref(false)
  const canContinueCatchUp = computed(() => {
    const status = recoveryStatus.value
    return Boolean(
      status?.found &&
      ['PREPARED', 'RUNNING'].includes(status.operationStatus ?? '') &&
      status.items.every((item) => item.status === 'PENDING' || item.status === 'ACCEPTED'),
    )
  })
  let recoverySequence = 0
  let catchupContextSequence = 0
  const recoveryScope = computed(() => {
    const actor = auth.userInfo?.username || ''
    if (!actor || !tenant.tenantId || !bizDate.value || !calendarCode.value.trim()) return ''
    const scopeKey = JSON.stringify([
      actor,
      tenant.tenantId,
      bizDate.value,
      calendarCode.value.trim(),
    ])
    return STORAGE_KEYS.batchDayCatchUpRecoveryPrefix + encodeURIComponent(scopeKey)
  })

  async function refreshCatchUpStatus() {
    const scope = recoveryScope.value
    const key = recoveryKey.value
    const tenantId = tenant.tenantId
    if (!scope || !key) return
    const sequence = ++recoverySequence
    recoveryLoading.value = true
    recoveryStatus.value = null
    try {
      const result = await getBatchDayCatchUpRequestStatus(tenantId, key)
      if (
        sequence === recoverySequence &&
        scope === recoveryScope.value &&
        key === recoveryKey.value
      ) {
        const matchesScope =
          result.tenantId === tenantId &&
          (!result.found ||
            (result.bizDate === bizDate.value && result.calendarCode === calendarCode.value.trim()))
        recoveryStatus.value = matchesScope ? result : null
      }
    } catch {
      // 查询失败不改变原请求结果，保留请求键供后续查询。
    } finally {
      if (sequence === recoverySequence) recoveryLoading.value = false
    }
  }

  async function reconcileCatchUp(jobCode: string) {
    const scope = recoveryScope.value
    const key = recoveryKey.value
    const tenantId = tenant.tenantId
    if (
      writesFrozen.value ||
      reconcileLoading.value ||
      continueLoading.value ||
      abandonLoading.value ||
      !scope ||
      !key ||
      !tenantId
    )
      return
    reconcileLoading.value = true
    try {
      await reconcileBatchDayCatchUpRequest(tenantId, key, jobCode)
    } catch {
      // 对账失败不改变未知结果，继续从原请求查询。
    } finally {
      reconcileLoading.value = false
      if (scope === recoveryScope.value && key === recoveryKey.value) await refreshCatchUpStatus()
    }
  }

  async function continueCatchUp() {
    const scope = recoveryScope.value
    const key = recoveryKey.value
    const tenantId = tenant.tenantId
    if (
      writesFrozen.value ||
      reconcileLoading.value ||
      continueLoading.value ||
      abandonLoading.value ||
      !canContinueCatchUp.value ||
      !scope ||
      !key ||
      !tenantId
    )
      return
    continueLoading.value = true
    try {
      await continueBatchDayCatchUpRequest(tenantId, key)
    } catch {
      // 结果不确定时保留原请求键并重新读取，不自动重发。
    } finally {
      continueLoading.value = false
      if (scope === recoveryScope.value && key === recoveryKey.value) await refreshCatchUpStatus()
    }
  }

  function restoreCatchUp() {
    ++catchupContextSequence
    ++recoverySequence
    recoveryLoading.value = false
    recoveryStatus.value = null
    recoveryKey.value = ''
    recoveryBlocked.value = !recoveryScope.value
    if (!recoveryScope.value) return
    try {
      const stored = localStorage.getItem(recoveryScope.value)
      if (stored !== null && !stored.trim()) throw new Error('invalid request key')
      recoveryKey.value = stored || ''
    } catch {
      recoveryBlocked.value = true
    }
    if (recoveryKey.value && canManageSystem.value) void refreshCatchUpStatus()
  }

  async function abandonUnpreparedCatchUp() {
    const scope = recoveryScope.value
    const key = recoveryKey.value
    const tenantId = tenant.tenantId
    const date = bizDate.value
    const calendar = calendarCode.value.trim()
    if (
      writesFrozen.value ||
      abandonLoading.value ||
      recoveryLoading.value ||
      reconcileLoading.value ||
      continueLoading.value ||
      !scope ||
      !key ||
      !recoveryStatus.value ||
      recoveryStatus.value.found
    )
      return
    try {
      await ElMessageBox.confirm(
        t('batchDayWindow.recoveryAbandonConfirm'),
        t('batchDayWindow.recoveryAbandon'),
        { type: 'warning' },
      )
    } catch {
      return
    }
    if (
      abandonLoading.value ||
      scope !== recoveryScope.value ||
      key !== recoveryKey.value ||
      !recoveryStatus.value ||
      recoveryStatus.value.found ||
      writesFrozen.value
    )
      return
    abandonLoading.value = true
    try {
      await abandonUnpreparedBatchDayCatchUp(tenantId, key, date, calendar)
    } catch {
      // 请求结果不确定时，保留原键并重新读取服务端状态。
    } finally {
      abandonLoading.value = false
      if (scope === recoveryScope.value && key === recoveryKey.value) await refreshCatchUpStatus()
    }
  }

  function acknowledgeCatchUp() {
    if (
      !recoveryStatus.value?.found ||
      !['COMPLETE', 'ABANDONED'].includes(recoveryStatus.value.operationStatus ?? '')
    )
      return
    try {
      if (localStorage.getItem(recoveryScope.value) !== recoveryKey.value)
        throw new Error('request changed')
      localStorage.removeItem(recoveryScope.value)
      recoveryKey.value = ''
      recoveryStatus.value = null
    } catch {
      recoveryBlocked.value = true
    }
  }

  watch([recoveryScope, canManageSystem], restoreCatchUp, { immediate: true })

  const catchupVisible = ref(false)
  const catchupLoading = ref(false)
  const catchupJobCodesText = ref('')
  const catchupForm = ref({
    calendarCode: '',
    reason: '',
  })
  const occurrenceCatchUpVisible = ref(false)
  const occurrenceCatchUpLoading = ref(false)
  const occurrenceCatchUpReason = ref('')
  const selectedOccurrence = ref<{
    tenantId: string
    occurrence: ConsoleBatchDayWindowResponse['scheduledOccurrences'][number]
  } | null>(null)

  function canOfferOccurrenceCatchUp(
    occurrence: ConsoleBatchDayWindowResponse['scheduledOccurrences'][number],
  ) {
    return (
      occurrence.occurrenceStatus === 'CLOSED_DAY_REJECTED' &&
      ['AUTO', 'MANUAL_APPROVAL'].includes(occurrence.catchUpPolicy) &&
      canMutateConfig.value
    )
  }

  function openOccurrenceCatchUp(
    occurrence: ConsoleBatchDayWindowResponse['scheduledOccurrences'][number],
  ) {
    if (writesFrozen.value || occurrence.occurrenceStatus !== 'CLOSED_DAY_REJECTED') return
    selectedOccurrence.value = { tenantId: tenant.tenantId, occurrence }
    occurrenceCatchUpReason.value = ''
    occurrenceCatchUpVisible.value = true
  }

  async function submitOccurrenceCatchUp() {
    const selection = selectedOccurrence.value
    const occurrence = selection?.occurrence
    const reason = occurrenceCatchUpReason.value.trim()
    const occurrenceCatchUpSubmissionIsBlocked =
      !selection ||
      !occurrence ||
      tenant.tenantId !== selection.tenantId ||
      !reason ||
      writesFrozen.value ||
      occurrenceCatchUpLoading.value
    if (occurrenceCatchUpSubmissionIsBlocked) return
    occurrenceCatchUpLoading.value = true
    try {
      const result = await workflowApi.catchUpScheduledOccurrence(occurrence.workflowDefinitionId, {
        tenantId: selection.tenantId,
        scheduledFireTime: occurrence.scheduledFireTime,
        bizDate: occurrence.bizDate,
        reason,
      })
      if (result.status === 'PENDING_APPROVAL') {
        ElMessage.success(
          t('batchDayWindow.occurrenceCatchUpApprovalCreated', {
            approvalId: result.approvalId || result.requestId,
          }),
        )
      } else {
        ElMessage.success(
          t('batchDayWindow.occurrenceCatchUpAccepted', { requestId: result.requestId }),
        )
      }
      occurrenceCatchUpVisible.value = false
      await load()
    } finally {
      occurrenceCatchUpLoading.value = false
    }
  }

  let windowReadSequence = 0
  async function load() {
    const sequence = ++windowReadSequence
    const tenantId = tenant.tenantId
    const bd = bizDate.value
    const cal = calendarCode.value.trim()
    window.value = null
    if (!tenantId || !bd || !cal) {
      loading.value = false
      return
    }
    loading.value = true
    const isCurrent = () =>
      sequence === windowReadSequence &&
      tenantId === tenant.tenantId &&
      bd === bizDate.value &&
      cal === calendarCode.value.trim()
    try {
      const result = await queryBatchDayWindow(tenantId, cal, bd)
      if (isCurrent()) window.value = result
    } catch {
      if (isCurrent()) window.value = null
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  function applyWindowQuery() {
    const date = bizDateDraft.value
    const value = calendarDraft.value.trim()
    if (!date || !value) {
      ElMessage.warning(t('batchDayWindow.missingQuery'))
      return
    }
    void router.replace({
      path: `/scheduler/batch-days/${date}`,
      query: { ...route.query, calendarCode: value },
    })
  }

  function openCatchup() {
    if (writesFrozen.value) return
    if (!calendarCode.value.trim()) {
      ElMessage.warning(t('batchDayWindow.missingCalendar'))
      return
    }
    catchupForm.value = {
      calendarCode: calendarCode.value.trim(),
      reason: '',
    }
    catchupJobCodesText.value = ''
    catchupVisible.value = true
  }

  function resetCatchup() {
    catchupJobCodesText.value = ''
    catchupForm.value.reason = ''
  }

  async function submitCatchup() {
    if (writesFrozen.value || recoveryBlocked.value || recoveryKey.value || catchupLoading.value)
      return
    const bd = bizDate.value
    const scope = recoveryScope.value
    const tenantId = tenant.tenantId
    if (!bd || !scope || !tenantId || catchupForm.value.calendarCode !== calendarCode.value.trim())
      return
    const raw = catchupJobCodesText.value.trim()
    let jobCodes: string[] | undefined
    if (raw) {
      const splitJobCodes = raw.split(/[,，\s]+/)
      const trimmedJobCodes = splitJobCodes.map((jobCode) => jobCode.trim())
      jobCodes = trimmedJobCodes.filter(Boolean)
    }

    const key = createIdempotencyKey()
    try {
      if (localStorage.getItem(scope) !== null) {
        restoreCatchUp()
        return
      }
      localStorage.setItem(scope, key)
      if (localStorage.getItem(scope) !== key) throw new Error('request key not saved')
      recoveryKey.value = key
    } catch {
      recoveryBlocked.value = true
      return
    }
    const contextSequence = catchupContextSequence
    catchupLoading.value = true
    try {
      const res = await launchBatchDayCatchUp(
        bd,
        {
          tenantId,
          calendarCode: catchupForm.value.calendarCode,
          jobCodes,
          reason: catchupForm.value.reason || undefined,
        },
        key,
      )
      if (contextSequence !== catchupContextSequence || scope !== recoveryScope.value) return
      const n = res.items?.length ?? 0
      ElMessage.success(t('batchDayWindow.submitSuccess', { n }))
      catchupVisible.value = false
      if (scope === recoveryScope.value && key === recoveryKey.value) await refreshCatchUpStatus()
      await load()
    } catch {
      if (
        contextSequence === catchupContextSequence &&
        scope === recoveryScope.value &&
        key === recoveryKey.value
      ) {
        catchupVisible.value = false
        await refreshCatchUpStatus()
      }
    } finally {
      catchupLoading.value = false
    }
  }

  watch(recoveryScope, () => {
    catchupVisible.value = false
    resetCatchup()
  })

  useTenantReload(load)
  watch(
    () => tenant.tenantId,
    (value) => {
      if (!value) {
        ++windowReadSequence
        window.value = null
        loading.value = false
      }
    },
  )

  watch(
    () => tenant.tenantId,
    (tenantId) => {
      if (selectedOccurrence.value && selectedOccurrence.value.tenantId !== tenantId) {
        occurrenceCatchUpVisible.value = false
        selectedOccurrence.value = null
        occurrenceCatchUpReason.value = ''
      }
    },
  )

  watch([bizDate, calendarCode], () => {
    bizDateDraft.value = bizDate.value
    calendarDraft.value = calendarCode.value || 'DEFAULT'
    void load()
  })
</script>

<style scoped>
  .batch-day-context {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .batch-day-context__field {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .batch-day-context__field :deep(.el-date-editor),
  .batch-day-context__field :deep(.el-select) {
    width: 12rem;
  }

  @media (max-width: 56.25rem) {
    .batch-day-context {
      align-items: stretch;
      flex-direction: column;
    }

    .batch-day-context__field :deep(.el-date-editor),
    .batch-day-context__field :deep(.el-select) {
      width: 100%;
    }
  }
</style>
