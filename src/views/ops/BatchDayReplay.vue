<template>
  <PageContainer>
    <PageHeader :title="t('batchDayReplay.title')" :description="t('batchDayReplay.description')">
      <template #actions>
        <el-button :icon="Refresh" :loading="loadingDetail" @click="reloadCurrent">
          {{ t('common.refresh') }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openSubmitDrawer">
          {{ t('batchDayReplay.submitBtn') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- Sessions 列表 -->
    <SectionCard class="replay-card">
      <template #header>
        <div class="replay-card__title">
          <span>{{ t('batchDayReplay.sessionsHeader') }}</span>
          <el-tag v-if="historyUnavailable" size="small" type="info" effect="plain">
            {{ t('batchDayReplay.historyUnavailableTag') }}
          </el-tag>
        </div>
        <el-button text type="primary" :icon="Plus" @click="openSubmitDrawer">
          {{ t('batchDayReplay.submitBtn') }}
        </el-button>
      </template>
      <el-alert
        v-if="historyUnavailable"
        type="info"
        :closable="false"
        show-icon
        class="replay-compat-alert"
      >
        <template #title>{{ t('batchDayReplay.historyUnavailableTitle') }}</template>
        <template #default>{{ t('batchDayReplay.historyUnavailableBody') }}</template>
      </el-alert>
      <el-table
        class="replay-sessions-table"
        :data="sessions"
        v-loading="loadingSessions"
        :empty-text="t('batchDayReplay.noSessions')"
        row-key="id"
        @row-click="openDetail"
        table-layout="fixed"
      >
        <template #empty>
          <EmptyState
            variant="empty"
            :title="t('batchDayReplay.emptyTitle')"
            :description="
              historyUnavailable
                ? t('batchDayReplay.emptyLegacyDesc')
                : t('batchDayReplay.emptyDesc')
            "
          >
            <template #action>
              <el-button type="primary" :icon="Plus" @click.stop="openSubmitDrawer">
                {{ t('batchDayReplay.submitBtn') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
        <el-table-column :label="t('batchDayReplay.colBizDate')" prop="bizDate" width="120" />
        <el-table-column :label="t('batchDayReplay.colMode')" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.executionMode === 'DRY_RUN' ? 'warning' : 'info'">
              {{ row.executionMode }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colScope')" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="scopeTagType(row.scope)" effect="plain">
              {{ row.scope }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colStatus')" width="160">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colProgress')" width="200">
          <template #default="{ row }">
            <el-progress :percentage="progressPct(row)" :status="progressStatus(row)" />
            <span class="cell-mute">
              {{ row.succeededCount ?? 0 }} / {{ row.totalCount ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colRequestedBy')" prop="requestedBy" />
        <DatetimeColumn :label="t('batchDayReplay.colCreatedAt')" prop="createdAt" width="180" />
      </el-table>
    </SectionCard>

    <!-- 提交抽屉 -->
    <el-drawer
      v-model="submitDrawerOpen"
      :title="t('batchDayReplay.submitTitle')"
      direction="rtl"
      size="640px"
      :before-close="onSubmitClose"
    >
      <el-alert
        v-if="submissionOutcomeUnknown"
        type="warning"
        :closable="false"
        show-icon
        class="replay-outcome-unknown"
        :title="t('batchDayReplay.submitOutcomeUnknownTitle')"
        :description="t('batchDayReplay.submitOutcomeUnknownBody')"
      />
      <el-form
        class="replay-submit-form"
        ref="submitFormRef"
        :model="submitForm"
        :disabled="Boolean(submissionOutcomeUnknown)"
        label-width="120px"
        @submit.prevent="doSubmit"
      >
        <el-form-item :label="t('batchDayReplay.fieldMode')" required>
          <el-segmented
            v-model="submitForm.executionMode"
            :options="[
              { label: t('batchDayReplay.modeReplay'), value: 'REPLAY' },
              { label: t('batchDayReplay.modeDryRun'), value: 'DRY_RUN' },
            ]"
          />
        </el-form-item>
        <el-form-item
          v-if="submitForm.executionMode === 'DRY_RUN'"
          :label="t('batchDayReplay.fieldCandidateSource')"
          required
        >
          <el-radio-group v-model="submitForm.candidateSource">
            <el-radio-button value="EXISTING_INSTANCES">
              {{ t('batchDayReplay.sourceExisting') }}
            </el-radio-button>
            <el-radio-button value="SCHEDULE_PLAN">
              {{ t('batchDayReplay.sourcePlan') }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldCalendar')" required>
          <el-input
            v-model="submitForm.calendarCode"
            :placeholder="t('batchDayReplay.calendarPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldBizDate')" required>
          <el-date-picker
            v-model="submitForm.bizDate"
            class="query-w-full"
            type="date"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldScope')" required>
          <el-radio-group v-model="submitForm.scope" class="replay-scope-group">
            <el-radio value="ALL">{{ t('batchDayReplay.scopeAll') }}</el-radio>
            <el-radio v-if="submitForm.candidateSource !== 'SCHEDULE_PLAN'" value="ALL_FAILED">
              {{ t('batchDayReplay.scopeAllFailed') }}
            </el-radio>
            <el-radio value="SUBSET_JOB_CODES">
              {{ t('batchDayReplay.scopeSubsetJobCodes') }}
            </el-radio>
            <el-radio v-if="submitForm.executionMode !== 'DRY_RUN'" value="OUTPUTS_ONLY">
              {{ t('batchDayReplay.scopeOutputsOnly') }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="submitForm.scope === 'SUBSET_JOB_CODES'"
          :label="t('batchDayReplay.fieldJobCodes')"
          required
        >
          <el-select
            v-model="selectedJobCodes"
            class="query-w-full"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :loading="loadingJobCodes"
            :placeholder="t('batchDayReplay.jobCodePickerPlaceholder')"
          >
            <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="submitForm.scope === 'OUTPUTS_ONLY'"
          :label="t('batchDayReplay.fieldOutputJobs')"
          required
        >
          <el-select
            v-model="selectedOutputJobCodes"
            class="query-w-full"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :loading="loadingJobCodes"
            :placeholder="t('batchDayReplay.jobCodePickerPlaceholder')"
          >
            <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
          </el-select>
          <p class="cell-mute">{{ t('batchDayReplay.outputJobsHint') }}</p>
        </el-form-item>
        <el-form-item
          v-if="submitForm.scope === 'OUTPUTS_ONLY'"
          :label="t('batchDayReplay.fieldVersionIds')"
          required
        >
          <el-select
            v-model="selectedVersionIds"
            class="query-w-full"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :loading="loadingOutputVersions"
            :placeholder="t('batchDayReplay.versionPickerPlaceholder')"
          >
            <el-option
              v-for="version in outputVersionOptions"
              :key="version.id"
              :label="version.label"
              :value="version.id"
            />
          </el-select>
          <p v-if="!selectedOutputJobCodes.length" class="cell-mute">
            {{ t('batchDayReplay.selectOutputJobsFirst') }}
          </p>
          <p
            v-else-if="!loadingOutputVersions && outputVersionOptions.length === 0"
            class="cell-mute"
          >
            {{ t('batchDayReplay.noPendingVersions') }}
          </p>
          <el-collapse class="advanced-version-ids">
            <el-collapse-item :title="t('batchDayReplay.advancedVersionIds')" name="version-ids">
              <el-input
                v-model="versionIdsText"
                type="textarea"
                :rows="2"
                :placeholder="t('batchDayReplay.fieldVersionIdsPlaceholder')"
              />
            </el-collapse-item>
          </el-collapse>
        </el-form-item>
        <el-form-item
          v-if="submitForm.executionMode !== 'DRY_RUN'"
          :label="t('batchDayReplay.fieldResultPolicy')"
        >
          <el-select v-model="submitForm.resultPolicy" class="query-w-full">
            <el-option
              :label="t('batchDayReplay.resultPolicyCreateNewVersion')"
              value="CREATE_NEW_VERSION"
            />
            <el-option :label="t('batchDayReplay.resultPolicyKeepBoth')" value="KEEP_BOTH" />
            <el-option
              :label="t('batchDayReplay.resultPolicyManualConfirmEffective')"
              value="MANUAL_CONFIRM_EFFECTIVE"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldConfigPolicy')">
          <el-select v-model="submitForm.configVersionPolicy" class="query-w-full">
            <el-option
              :label="t('batchDayReplay.configPolicyUseOriginal')"
              value="USE_ORIGINAL_CONFIG"
            />
            <el-option
              :label="t('batchDayReplay.configPolicyUseLatest')"
              value="USE_LATEST_CONFIG"
            />
            <el-option
              :label="t('batchDayReplay.configPolicyUseSpecified')"
              value="USE_SPECIFIED_VERSION"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="submitForm.configVersionPolicy === 'USE_SPECIFIED_VERSION'"
          :label="t('batchDayReplay.fieldConfigVersion')"
        >
          <el-input-number v-model="submitForm.configVersion" :min="1" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldReason')" required>
          <el-input
            v-model="submitForm.reason"
            type="textarea"
            :rows="2"
            :placeholder="t('batchDayReplay.fieldReasonPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldAutoApprove')">
          <el-switch v-model="submitForm.autoApprove" />
          <span class="cell-mute">
            {{
              submitForm.autoApprove
                ? t('batchDayReplay.autoApproveOnHint')
                : t('batchDayReplay.autoApproveOffHint')
            }}
          </span>
        </el-form-item>
      </el-form>

      <div v-if="preview" class="preview-panel">
        <div class="preview-panel__head">
          <div>
            <div class="preview-panel__title">{{ t('batchDayReplay.previewTitle') }}</div>
            <div class="preview-panel__sub">
              {{
                t('batchDayReplay.previewSummary', {
                  total: preview.totalCount,
                  result: preview.resultVersionImpacts.length,
                  asset: preview.assetPartitionImpacts.length,
                  dispatch: preview.dispatchImpacts.length,
                })
              }}
            </div>
          </div>
          <el-tag size="small" effect="plain">{{ replayScopeLabel(preview.scope) }}</el-tag>
        </div>
        <el-alert
          v-if="preview.warnings.length"
          type="warning"
          show-icon
          :closable="false"
          class="preview-warning"
        >
          <template #default>
            <div v-for="w in preview.warnings" :key="w">{{ w }}</div>
          </template>
        </el-alert>
        <div class="preview-panel__summary">
          {{ t('batchDayReplay.previewEntriesSummary', { count: preview.entries.length }) }}
        </div>
        <el-table
          class="replay-preview-table"
          :data="previewPageEntries"
          size="small"
          border
          :empty-text="t('common.noData')"
        >
          <el-table-column prop="jobCode" :label="t('batchDayReplay.colJobCode')" min-width="160" />
          <el-table-column prop="action" :label="t('batchDayReplay.previewColAction')" width="180">
            <template #default="{ row }">{{ replayActionLabel(row.action) }}</template>
          </el-table-column>
          <el-table-column
            prop="businessKey"
            :label="t('batchDayReplay.previewColBusinessKey')"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="sourceInstanceId"
            :label="t('batchDayReplay.previewColSourceInstance')"
            width="140"
          />
          <el-table-column
            prop="resultVersionId"
            :label="t('batchDayReplay.previewColResultVersion')"
            width="140"
          />
        </el-table>
        <el-pagination
          v-if="preview.entries.length > previewPageSize"
          v-model:current-page="previewPage"
          :page-size="previewPageSize"
          :total="preview.entries.length"
          layout="total, prev, pager, next"
          class="replay-preview-pagination"
        />
      </div>
      <template #footer>
        <el-button :disabled="Boolean(submissionOutcomeUnknown)" @click="submitDrawerOpen = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          :loading="previewing"
          :disabled="Boolean(submissionOutcomeUnknown)"
          @click="doPreview"
        >
          {{ t('batchDayReplay.previewBtn') }}
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!submissionOutcomeUnknown && (!preview || preview.totalCount === 0)"
          @click="doSubmit"
        >
          {{
            submissionOutcomeUnknown
              ? t('batchDayReplay.resolveSubmitOutcome')
              : t('batchDayReplay.submitConfirm')
          }}
        </el-button>
      </template>
    </el-drawer>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailDrawerOpen"
      :title="
        currentSession
          ? t('batchDayReplay.detailTitle', { id: currentSession.id })
          : t('batchDayReplay.detailTitleEmpty')
      "
      direction="rtl"
      size="720px"
    >
      <div v-if="currentSession">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('batchDayReplay.colStatus')">
            <el-tag :type="statusTagType(currentSession.status)">{{
              currentSession.status
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colScope')">
            {{ currentSession.scope }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colBizDate')">
            {{ currentSession.bizDate }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.fieldCalendar')">
            {{ currentSession.calendarCode }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.colRequestedBy')">
            {{ currentSession.requestedBy }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentSession.approvedBy"
            :label="t('batchDayReplay.fieldApprovedBy')"
          >
            {{ currentSession.approvedBy }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('batchDayReplay.fieldReason')" :span="2">
            {{ currentSession.reason }}
          </el-descriptions-item>
        </el-descriptions>

        <el-progress
          :percentage="progressPct(currentSession)"
          :status="progressStatus(currentSession)"
          class="detail-progress"
        />
        <div class="cell-mute">
          {{
            t('batchDayReplay.entriesSummary', {
              ok: currentSession.succeededCount ?? 0,
              fail: currentSession.failedCount ?? 0,
              pending: currentSession.inFlightCount ?? 0,
              total: currentSession.totalCount ?? 0,
            })
          }}
        </div>

        <el-divider />
        <div class="entries-toolbar">
          <StatusSegment
            v-model="entriesStatusFilter"
            :items="entriesStatusItems"
            :aria-label="t('batchDayReplay.allEntries')"
            @update:model-value="loadEntries"
          />
        </div>
        <el-table
          class="replay-entries-table"
          :data="entries"
          v-loading="loadingEntries"
          :empty-text="t('batchDayReplay.noEntries')"
          size="small"
        >
          <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
          <el-table-column :label="t('batchDayReplay.colJobCode')" prop="jobCode" />
          <el-table-column :label="t('batchDayReplay.colStatus')" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="entryStatusTagType(row.status)">
                {{
                  row.status === 'SUCCEEDED'
                    ? t('batchDayReplay.entryStatusSucceeded')
                    : row.status === 'FAILED'
                      ? t('batchDayReplay.entryStatusFailed')
                      : t('batchDayReplay.entryStatusPending')
                }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('batchDayReplay.colFailureReason')"
            prop="failureReason"
            show-overflow-tooltip
          />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailDrawerOpen = false">{{ t('common.close') }}</el-button>
        <el-button v-if="canApprove" type="success" :loading="approving" @click="doApprove">
          {{ t('batchDayReplay.approveBtn') }}
        </el-button>
        <el-button v-if="canCancel" type="danger" :loading="cancelling" @click="doCancel">
          {{ t('batchDayReplay.cancelBtn') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { RefreshCw as Refresh, Plus } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusSegment, { type StatusSegmentItem } from '@/components/table/StatusSegment.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { todayBusinessDate } from '@/utils/datetime'
  import { batchDayReplayRequestKey, isReplayPreviewCurrent } from '@/utils/batchDayReplayForm'
  import {
    batchDayReplayApi,
    type BatchDayReplaySession,
    type BatchDayReplayEntry,
    type BatchDayReplaySubmitRequest,
    type BatchDayReplayPreview,
  } from '@/api/batchDayReplay'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAuthStore } from '@/stores/auth'
  import { buildBatchDayReplayRequest } from '@/utils/batchDayReplayForm'
  import { jobApi } from '@/api/job'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()

  const sessions = ref<BatchDayReplaySession[]>([])
  const loadingSessions = ref(false)
  const loadingDetail = ref(false)
  const historyUnavailable = ref(false)

  const submitDrawerOpen = ref(false)
  const submitting = ref(false)
  const submissionOutcomeUnknown = ref<BatchDayReplaySubmitRequest | null>(null)
  const submitForm = reactive<BatchDayReplaySubmitRequest>({
    tenantId: tenant.tenantId,
    calendarCode: 'default',
    bizDate: todayBusinessDate(),
    scope: 'ALL',
    executionMode: 'REPLAY',
    candidateSource: 'EXISTING_INSTANCES',
    resultPolicy: 'CREATE_NEW_VERSION',
    configVersionPolicy: 'USE_ORIGINAL_CONFIG',
    reason: '',
    requestedBy: auth.userInfo?.username ?? '',
    autoApprove: false,
  })
  const selectedJobCodes = ref<string[]>([])
  const selectedOutputJobCodes = ref<string[]>([])
  const selectedVersionIds = ref<number[]>([])
  const jobCodeOptions = ref<string[]>([])
  const loadingJobCodes = ref(false)
  const loadingOutputVersions = ref(false)
  const outputVersionOptions = ref<Array<{ id: number; label: string }>>([])
  let versionLookupGeneration = 0
  const versionIdsText = ref('')
  const preview = ref<BatchDayReplayPreview | null>(null)
  const previewing = ref(false)
  const previewRequestKey = ref<string | null>(null)
  const previewPage = ref(1)
  const previewPageSize = 20
  const replayScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      ALL: t('batchDayReplay.scopeAll'),
      ALL_FAILED: t('batchDayReplay.scopeAllFailed'),
      SUBSET_JOB_CODES: t('batchDayReplay.scopeSubsetJobCodes'),
      OUTPUTS_ONLY: t('batchDayReplay.scopeOutputsOnly'),
    }
    return labels[scope] ?? scope
  }
  const replayActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      RERUN_INSTANCE: t('batchDayReplay.previewActionRerun'),
      LAUNCH_SCHEDULE_PLAN: t('batchDayReplay.previewActionLaunch'),
      PROMOTE_RESULT_VERSION: t('batchDayReplay.previewActionPromote'),
    }
    return labels[action] ?? action
  }
  const previewPageEntries = computed(() => {
    const start = (previewPage.value - 1) * previewPageSize
    return preview.value?.entries.slice(start, start + previewPageSize) ?? []
  })

  watch(
    () => [
      submitForm.calendarCode,
      submitForm.bizDate,
      submitForm.scope,
      submitForm.executionMode,
      submitForm.candidateSource,
      submitForm.resultPolicy,
      submitForm.configVersionPolicy,
      submitForm.configVersion,
      submitForm.reason,
      submitForm.autoApprove,
      selectedJobCodes.value.join(','),
      selectedOutputJobCodes.value.join(','),
      [...selectedVersionIds.value.map(String), versionIdsText.value].filter(Boolean).join(','),
    ],
    () => {
      preview.value = null
      previewRequestKey.value = null
      previewPage.value = 1
    },
  )

  watch(
    () => submitForm.executionMode,
    (mode) => {
      if (mode === 'DRY_RUN') {
        submitForm.resultPolicy = 'DRY_RUN_ONLY'
        if (submitForm.scope === 'OUTPUTS_ONLY') {
          submitForm.scope = 'ALL'
        }
      } else {
        submitForm.candidateSource = 'EXISTING_INSTANCES'
        submitForm.resultPolicy = 'CREATE_NEW_VERSION'
      }
    },
  )

  watch(
    () => submitForm.candidateSource,
    (source) => {
      if (source === 'SCHEDULE_PLAN' && submitForm.scope === 'ALL_FAILED') {
        submitForm.scope = 'ALL'
      }
    },
  )

  watch(
    () => [submitForm.scope, submitForm.bizDate, tenant.tenantId, ...selectedOutputJobCodes.value],
    async ([scope, bizDate, tenantId]) => {
      const generation = ++versionLookupGeneration
      loadingOutputVersions.value = false
      selectedVersionIds.value = []
      outputVersionOptions.value = []
      if (scope !== 'OUTPUTS_ONLY' || !bizDate || !selectedOutputJobCodes.value.length) return

      loadingOutputVersions.value = true
      try {
        const versionsByJob = await Promise.all(
          selectedOutputJobCodes.value.map(async (jobCode) => {
            const versions = await batchDayReplayApi.resultVersions(
              tenantId,
              `job:${jobCode}:${bizDate}`,
            )
            return versions
              .filter((version) => version.status === 'PENDING')
              .map((version) => ({
                id: version.id,
                label: `${jobCode} · v${version.versionNo} · ${version.status} · #${version.id}`,
              }))
          }),
        )
        if (generation === versionLookupGeneration)
          outputVersionOptions.value = versionsByJob.flat()
      } catch (error) {
        if (generation === versionLookupGeneration) {
          ElMessage.error(userErrorMessage(error))
        }
      } finally {
        if (generation === versionLookupGeneration) loadingOutputVersions.value = false
      }
    },
  )

  const detailDrawerOpen = ref(false)
  const currentSession = ref<BatchDayReplaySession | null>(null)
  const entries = ref<BatchDayReplayEntry[]>([])
  const loadingEntries = ref(false)
  const entriesStatusFilter = ref<'' | 'PENDING' | 'SUCCEEDED' | 'FAILED'>('')
  const entriesStatusItems = computed<StatusSegmentItem[]>(() => [
    { value: '', label: t('batchDayReplay.allEntries'), tone: 'neutral' },
    { value: 'PENDING', label: t('batchDayReplay.entryStatusPending'), tone: 'warning' },
    { value: 'SUCCEEDED', label: t('batchDayReplay.entryStatusSucceeded'), tone: 'success' },
    { value: 'FAILED', label: t('batchDayReplay.entryStatusFailed'), tone: 'danger' },
  ])
  const approving = ref(false)
  const cancelling = ref(false)

  const isPlatformAdmin = computed(() => auth.hasPermission('ROLE_ADMIN'))

  /** 仅 PENDING_APPROVAL 状态 + ADMIN 角色可以审批 */
  const canApprove = computed(
    () => currentSession.value?.status === 'PENDING_APPROVAL' && isPlatformAdmin.value,
  )
  /** RUNNING / PENDING_APPROVAL 都可取消;ADMIN 或 提交人本人 */
  const canCancel = computed(() => {
    const s = currentSession.value
    if (!s) return false
    if (s.status !== 'RUNNING' && s.status !== 'PENDING_APPROVAL') return false
    return isPlatformAdmin.value || s.requestedBy === auth.userInfo?.username
  })

  function scopeTagType(scope: string): 'primary' | 'warning' | 'success' | 'info' {
    if (scope === 'ALL') return 'primary'
    if (scope === 'ALL_FAILED') return 'warning'
    if (scope === 'OUTPUTS_ONLY') return 'success'
    return 'info'
  }
  function statusTagType(s: string): 'primary' | 'success' | 'danger' | 'warning' | 'info' {
    if (s === 'RUNNING') return 'primary'
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED') return 'danger'
    if (s === 'PENDING_APPROVAL') return 'warning'
    return 'info'
  }
  function entryStatusTagType(s: string): 'success' | 'danger' | 'info' {
    if (s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED') return 'danger'
    return 'info'
  }
  function progressPct(s: BatchDayReplaySession): number {
    const total = s.totalCount ?? 0
    if (total === 0) return 0
    const done = (s.succeededCount ?? 0) + (s.failedCount ?? 0)
    return Math.round((done / total) * 100)
  }
  function progressStatus(s: BatchDayReplaySession): 'success' | 'exception' | undefined {
    if (s.status === 'SUCCEEDED') return 'success'
    if (s.status === 'FAILED') return 'exception'
    return undefined
  }

  function buildSubmitRequest(): BatchDayReplaySubmitRequest | null {
    const result = buildBatchDayReplayRequest(
      submitForm,
      tenant.tenantId,
      selectedJobCodes.value.join(','),
      [...selectedVersionIds.value.map(String), versionIdsText.value].filter(Boolean).join(','),
    )
    if (result.error) {
      ElMessage.warning(t(`batchDayReplay.${result.error}`))
      return null
    }
    return result.request
  }

  async function doPreview() {
    const req = buildSubmitRequest()
    if (!req) return
    preview.value = null
    previewRequestKey.value = null
    previewing.value = true
    try {
      preview.value = await batchDayReplayApi.preview(req)
      previewRequestKey.value = batchDayReplayRequestKey(req)
      previewPage.value = 1
      ElMessage.success(t('batchDayReplay.previewOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      previewing.value = false
    }
  }

  async function doSubmit() {
    if (submissionOutcomeUnknown.value) {
      await resolveUnknownSubmitOutcome()
      return
    }
    const req = buildSubmitRequest()
    if (!req) return
    if (!preview.value || !isReplayPreviewCurrent(req, previewRequestKey.value)) {
      preview.value = null
      previewRequestKey.value = null
      ElMessage.warning(t('batchDayReplay.previewRequired'))
      return
    }
    if (!preview.value.previewToken || Date.parse(preview.value.expiresAt) <= Date.now()) {
      preview.value = null
      previewRequestKey.value = null
      ElMessage.warning(t('batchDayReplay.previewExpired'))
      return
    }
    const submissionRequest = { ...req, previewToken: preview.value.previewToken }
    submitting.value = true
    try {
      await showSubmittedSession(await batchDayReplayApi.submit(submissionRequest))
    } catch (err) {
      if (isUnknownNetworkOutcome(err)) {
        submissionOutcomeUnknown.value = submissionRequest
        ElMessage.warning(t('batchDayReplay.submitOutcomeUnknownTitle'))
      } else {
        // 内层业务错误不会触发 Axios 全局 envelope toast，需在此展示。
        ElMessage.error(userErrorMessage(err))
      }
    } finally {
      submitting.value = false
    }
  }

  async function resolveUnknownSubmitOutcome() {
    const request = submissionOutcomeUnknown.value
    if (!request) return
    submitting.value = true
    try {
      const session = await batchDayReplayApi.resolveSubmitOutcome(request)
      submissionOutcomeUnknown.value = null
      await showSubmittedSession(session)
    } catch (err) {
      if (isUnknownNetworkOutcome(err)) {
        ElMessage.warning(t('batchDayReplay.submitOutcomeStillUnknown'))
      } else {
        ElMessage.error(userErrorMessage(err))
      }
    } finally {
      submitting.value = false
    }
  }

  async function showSubmittedSession(session: BatchDayReplaySession) {
    upsertSession(session)
    ElMessage.success(t('batchDayReplay.submitOk'))
    submitDrawerOpen.value = false
    currentSession.value = session
    detailDrawerOpen.value = true
    try {
      await loadEntries()
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    }
  }

  function isUnknownNetworkOutcome(error: unknown): boolean {
    if (!(error instanceof Error) || !('isAxiosError' in error) || error.isAxiosError !== true) {
      return false
    }
    return !('response' in error) || error.response == null
  }

  function onSubmitClose(done: () => void) {
    if (submissionOutcomeUnknown.value) return
    submitDrawerOpen.value = false
    preview.value = null
    previewRequestKey.value = null
    done()
  }

  async function openSubmitDrawer() {
    submitDrawerOpen.value = true
    if (!jobCodeOptions.value.length) await loadJobCodeOptions()
  }

  async function loadJobCodeOptions() {
    loadingJobCodes.value = true
    try {
      jobCodeOptions.value = await jobApi.listCodes(tenant.tenantId)
    } catch (error) {
      jobCodeOptions.value = []
      ElMessage.error(userErrorMessage(error))
    } finally {
      loadingJobCodes.value = false
    }
  }

  async function openDetail(row: BatchDayReplaySession) {
    detailDrawerOpen.value = true
    currentSession.value = row
    entries.value = []
    entriesStatusFilter.value = ''
    await Promise.all([reloadCurrent(), loadEntries()])
  }

  async function reloadCurrent() {
    if (!currentSession.value) return
    loadingDetail.value = true
    try {
      const fresh = await batchDayReplayApi.detail(currentSession.value.id, tenant.tenantId)
      currentSession.value = fresh
      upsertSession(fresh)
    } finally {
      loadingDetail.value = false
    }
  }

  async function loadEntries() {
    if (!currentSession.value) return
    loadingEntries.value = true
    try {
      entries.value = await batchDayReplayApi.entries(currentSession.value.id, {
        status: entriesStatusFilter.value || undefined,
        tenantId: tenant.tenantId,
      })
    } finally {
      loadingEntries.value = false
    }
  }

  async function doApprove() {
    if (!currentSession.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.approveBtn'),
        target: '',
        consequence: t('batchDayReplay.approveConfirmHint'),
        irreversible: true,
      })
    } catch {
      // 用户点取消 → early return,不执行高危 ops
      return
    }
    approving.value = true
    try {
      const fresh = await batchDayReplayApi.approve(
        currentSession.value.id,
        auth.userInfo?.username ?? 'unknown',
        tenant.tenantId,
      )
      currentSession.value = fresh
      upsertSession(fresh)
      ElMessage.success(t('batchDayReplay.approveOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      approving.value = false
    }
  }

  async function doCancel() {
    if (!currentSession.value) return
    try {
      await confirmDanger({
        verb: t('batchDayReplay.cancelBtn'),
        target: '',
        consequence: t('batchDayReplay.cancelConfirmHint'),
      })
    } catch {
      // 用户点取消 → early return,不执行高危 ops
      return
    }
    cancelling.value = true
    try {
      const fresh = await batchDayReplayApi.cancel(currentSession.value.id, tenant.tenantId)
      currentSession.value = fresh
      upsertSession(fresh)
      ElMessage.success(t('batchDayReplay.cancelOk'))
    } catch (err) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      cancelling.value = false
    }
  }

  function upsertSession(session: BatchDayReplaySession) {
    const idx = sessions.value.findIndex((s) => s.id === session.id)
    if (idx >= 0) sessions.value.splice(idx, 1, session)
    else sessions.value.unshift(session)
  }

  async function loadSessions() {
    loadingSessions.value = true
    try {
      sessions.value = await batchDayReplayApi.list({ tenantId: tenant.tenantId, limit: 50 })
      historyUnavailable.value = false
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      historyUnavailable.value = status === 404 || status === 405
      sessions.value = []
    } finally {
      loadingSessions.value = false
    }
  }

  useTenantReload(() => {
    submitForm.tenantId = tenant.tenantId
    jobCodeOptions.value = []
    selectedJobCodes.value = []
    selectedOutputJobCodes.value = []
    selectedVersionIds.value = []
    sessions.value = []
    currentSession.value = null
    entries.value = []
    historyUnavailable.value = false
    return loadSessions()
  })
</script>

<style scoped>
  .replay-card__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .replay-compat-alert {
    margin-bottom: 12px;
  }

  .replay-scope-group {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    max-width: 100%;
    overflow-x: auto;
    padding: 2px 0;
  }

  .replay-scope-group :deep(.el-radio) {
    flex: 0 0 auto;
    margin-right: 0;
    white-space: nowrap;
  }

  .detail-progress {
    margin: 14px 0 6px;
  }
  .entries-toolbar {
    margin: 8px 0;
  }
  .cell-mute {
    color: var(--color-text-secondary);
    font-size: 12px;
    margin-left: 8px;
  }

  .preview-panel {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
  }

  .replay-sessions-table :deep(.el-table__cell .cell),
  .replay-preview-table :deep(.el-table__cell .cell),
  .replay-entries-table :deep(.el-table__cell .cell) {
    min-width: 0;
  }

  .preview-panel__summary {
    margin: 8px 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .replay-preview-pagination {
    justify-content: flex-end;
    margin-top: 12px;
  }

  .replay-submit-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .preview-panel__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .preview-panel__title {
    font-size: 14px;
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .preview-panel__sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .preview-warning {
    margin-bottom: 10px;
  }

  @media (max-width: 720px) {
    .preview-panel__head {
      flex-direction: column;
    }
  }
</style>
