<template>
  <PageContainer>
    <PageHeader :title="t('batchDayReplay.title')" :description="t('batchDayReplay.description')">
      <template #actions>
        <el-button :icon="Refresh" :loading="loadingDetail" @click="reloadCurrent">
          {{ t('common.refresh') }}
        </el-button>
        <el-button type="primary" :icon="Plus" :disabled="writesFrozen" @click="openSubmitDrawer">
          {{ t('batchDayReplay.submitBtn') }}
        </el-button>
        <el-button :disabled="writesFrozen" @click="openRangeDrawer">
          {{ t('batchDayReplay.rangeSubmitBtn') }}
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
        <el-button
          text
          type="primary"
          :icon="Plus"
          :disabled="writesFrozen"
          @click="openSubmitDrawer"
        >
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
      <BatchDayReplaySessionsTable
        :sessions="sessions"
        :loading="loadingSessions"
        :history-unavailable="historyUnavailable"
        :writes-frozen="writesFrozen"
        :scope-tag-type="scopeTagType"
        :status-tag-type="statusTagType"
        :progress-pct="progressPct"
        :progress-status="progressStatus"
        @open-detail="openDetail"
        @submit="openSubmitDrawer"
      />
    </SectionCard>

    <ResultVersionGovernancePanel />

    <SectionCard class="replay-card">
      <template #header>{{ t('batchDayReplay.operationsHeader') }}</template>
      <el-table :data="operations" v-loading="loadingOperations" row-key="id" table-layout="fixed">
        <el-table-column :label="t('batchDayReplay.colId')" prop="id" width="80" />
        <el-table-column :label="t('batchDayReplay.operationRange')" min-width="210">
          <template #default="{ row }">{{ row.fromDate }} – {{ row.throughDate }}</template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colScope')" prop="scope" width="140" />
        <el-table-column :label="t('batchDayReplay.colStatus')" width="160">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colProgress')" width="210">
          <template #default="{ row }">
            <el-progress :percentage="operationProgressPct(row as ReplayOperation)" />
            <span class="cell-mute">{{ row.succeededCount }} / {{ row.totalCount }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.colRequestedBy')" prop="requestedBy" />
        <el-table-column :label="t('batchDayReplay.colCreatedAt')" prop="createdAt" width="180" />
        <el-table-column :label="t('batchDayReplay.colActions')" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openOperation(row as ReplayOperation)">
              {{ t('common.detail') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-drawer v-model="rangeDrawerOpen" :title="t('batchDayReplay.rangeSubmitTitle')" direction="rtl" size="560px">
      <el-form label-width="120px">
        <el-form-item :label="t('batchDayReplay.fieldMode')" required>
          <el-segmented
            v-model="rangeForm.executionMode"
            :options="[
              { label: t('batchDayReplay.modeReplay'), value: 'REPLAY' },
              { label: t('batchDayReplay.modeDryRun'), value: 'DRY_RUN' },
            ]"
          />
        </el-form-item>
        <el-form-item v-if="rangeForm.executionMode === 'DRY_RUN'" :label="t('batchDayReplay.fieldCandidateSource')" required>
          <el-radio-group v-model="rangeForm.candidateSource">
            <el-radio-button value="EXISTING_INSTANCES">{{ t('batchDayReplay.sourceExisting') }}</el-radio-button>
            <el-radio-button value="SCHEDULE_PLAN">{{ t('batchDayReplay.sourcePlan') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldCalendar')" required>
          <el-input v-model="rangeForm.calendarCode" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldDateRange')" required>
          <el-date-picker
            v-model="rangeDates"
            type="daterange"
            value-format="YYYY-MM-DD"
            class="query-w-full"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldScope')" required>
          <el-radio-group v-model="rangeForm.scope">
            <el-radio value="ALL">{{ t('batchDayReplay.scopeAll') }}</el-radio>
            <el-radio v-if="rangeForm.candidateSource !== 'SCHEDULE_PLAN'" value="ALL_FAILED">
              {{ t('batchDayReplay.scopeAllFailed') }}
            </el-radio>
          <el-radio value="SUBSET_JOB_CODES">{{ t('batchDayReplay.scopeSubsetJobCodes') }}</el-radio>
          <el-radio v-if="rangeForm.executionMode !== 'DRY_RUN'" value="OUTPUTS_ONLY">
            {{ t('batchDayReplay.scopeOutputsOnly') }}
          </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="rangeForm.scope === 'SUBSET_JOB_CODES'" :label="t('batchDayReplay.fieldJobCodes')" required>
          <el-select
            v-model="selectedRangeJobCodes"
            class="query-w-full"
            multiple
            filterable
            collapse-tags
            :loading="loadingJobCodes"
            :placeholder="t('batchDayReplay.jobCodePickerPlaceholder')"
          >
            <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="rangeForm.scope === 'OUTPUTS_ONLY'" :label="t('batchDayReplay.fieldVersionIds')" required>
          <el-input
            v-model="rangeVersionIdsText"
            type="textarea"
            :rows="3"
            :placeholder="t('batchDayReplay.rangeVersionIdsHint')"
          />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldResultPolicy')">
          <el-select v-model="rangeForm.resultPolicy" class="query-w-full">
            <el-option label="CREATE_NEW_VERSION" value="CREATE_NEW_VERSION" />
            <el-option label="KEEP_BOTH" value="KEEP_BOTH" />
            <el-option label="MANUAL_CONFIRM_EFFECTIVE" value="MANUAL_CONFIRM_EFFECTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldConfigPolicy')">
          <el-select v-model="rangeForm.configVersionPolicy" class="query-w-full">
            <el-option :label="t('batchDayReplay.configPolicyUseOriginal')" value="USE_ORIGINAL_CONFIG" />
            <el-option :label="t('batchDayReplay.configPolicyUseLatest')" value="USE_LATEST_CONFIG" />
            <el-option :label="t('batchDayReplay.configPolicyUseSpecified')" value="USE_SPECIFIED_VERSION" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="rangeForm.configVersionPolicy === 'USE_SPECIFIED_VERSION'" :label="t('batchDayReplay.fieldConfigVersion')" required>
          <el-input-number v-model="rangeForm.configVersion" :min="1" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldReason')" required>
          <el-input v-model="rangeForm.reason" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('batchDayReplay.fieldAutoApprove')">
          <el-switch v-model="rangeForm.autoApprove" />
        </el-form-item>
      </el-form>
      <el-alert v-if="rangePreview" type="info" :closable="false" class="preview-panel">
        <template #title>{{ t('batchDayReplay.rangePreviewSummary', { days: rangePreview.days.length, candidates: rangePreview.totalCandidateCount }) }}</template>
        <el-table :data="rangePreview.days" size="small" max-height="300">
          <el-table-column prop="bizDate" :label="t('batchDayReplay.colBizDate')" width="120" />
          <el-table-column prop="disposition" :label="t('batchDayReplay.colStatus')" width="170" />
          <el-table-column prop="candidateCount" :label="t('batchDayReplay.colProgress')" />
        </el-table>
      </el-alert>
      <template #footer>
        <el-button :loading="rangePreviewing" :disabled="rangeSubmitting" @click="previewRange">{{ t('batchDayReplay.previewBtn') }}</el-button>
        <el-button
          type="primary"
          :disabled="!isCurrentRangePreview || !rangePreview?.totalCandidateCount"
          :loading="rangeSubmitting"
          @click="submitRange"
        >
          {{ t('batchDayReplay.submitConfirm') }}
        </el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="operationDrawerOpen" :title="t('batchDayReplay.operationDetailTitle')" direction="rtl" size="520px">
      <el-descriptions v-if="currentOperation" :column="1" border>
        <el-descriptions-item :label="t('batchDayReplay.colId')">{{ currentOperation.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.operationRange')">{{ currentOperation.fromDate }} – {{ currentOperation.throughDate }}</el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.colStatus')">{{ currentOperation.status }}</el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.colProgress')">{{ currentOperation.succeededCount }} / {{ currentOperation.totalCount }} ({{ currentOperation.failedCount }} {{ t('batchDayReplay.colFailed') }})</el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.colRequestedBy')">{{ currentOperation.requestedBy }}</el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.fieldApprovedBy')">{{ currentOperation.approvedBy || '—' }}</el-descriptions-item>
      </el-descriptions>
      <h4>{{ t('batchDayReplay.operationDays') }}</h4>
      <el-table :data="operationSessions" v-loading="loadingOperationSessions" row-key="id" size="small">
        <el-table-column :label="t('batchDayReplay.colDate')" prop="bizDate" width="120" />
        <el-table-column :label="t('batchDayReplay.colStatus')" prop="status" width="150" />
        <el-table-column :label="t('batchDayReplay.colProgress')" min-width="160">
          <template #default="{ row }">
            {{ row.succeededCount ?? 0 }} / {{ row.totalCount ?? 0 }}
            <span class="cell-mute">({{ row.failedCount ?? 0 }} {{ t('batchDayReplay.colFailed') }})</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openChildSession(row as BatchDayReplaySession)">
              {{ t('batchDayReplay.viewDaySession') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="refreshOperation">{{ t('common.refresh') }}</el-button>
        <el-button v-if="canApproveOperation" type="success" :loading="operationActing" @click="approveOperation">
          {{ t('batchDayReplay.approveBtn') }}
        </el-button>
        <el-button v-if="canCancelOperation" type="danger" :loading="operationActing" @click="cancelOperation">
          {{ t('batchDayReplay.cancelBtn') }}
        </el-button>
      </template>
    </el-drawer>

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
        id="batch-day-replay-form"
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
        <el-button
          native-type="button"
          :disabled="Boolean(submissionOutcomeUnknown)"
          @click="submitDrawerOpen = false"
        >
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
          native-type="submit"
          form="batch-day-replay-form"
          :loading="submitting"
          :disabled="
            !submissionOutcomeUnknown && (writesFrozen || !preview || preview.totalCount === 0)
          "
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
          <el-table-column :label="t('common.actions')" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'FAILED' && row.rerunInstanceId == null"
                link
                type="primary"
                :disabled="writesFrozen || retryingEntryId === row.id"
                :loading="retryingEntryId === row.id"
                @click="retryFailedSubmission(row as BatchDayReplayEntry)"
              >
                {{ t('batchDayReplay.retrySubmission') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailDrawerOpen = false">{{ t('common.close') }}</el-button>
        <el-button
          v-if="canApprove"
          type="success"
          :loading="approving"
          :disabled="writesFrozen"
          @click="doApprove"
        >
          {{ t('batchDayReplay.approveBtn') }}
        </el-button>
        <el-button
          v-if="canCancel"
          type="danger"
          :loading="cancelling"
          :disabled="writesFrozen"
          @click="doCancel"
        >
          {{ t('batchDayReplay.cancelBtn') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { RefreshCw as Refresh, Plus } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusSegment from '@/components/table/StatusSegment.vue'
  import ResultVersionGovernancePanel from './components/ResultVersionGovernancePanel.vue'
  import BatchDayReplaySessionsTable from './components/BatchDayReplaySessionsTable.vue'
  import type { BatchDayReplaySession, BatchDayReplayEntry, ReplayOperation } from '@/api/batchDayReplay'
  import { useBatchDayReplay } from './composables/useBatchDayReplay'

  const {
    t,
    writesFrozen,
    sessions,
    operations,
    operationSessions,
    loadingOperationSessions,
    loadingOperations,
    loadingSessions,
    loadingDetail,
    historyUnavailable,
    rangeDrawerOpen,
    rangeDates,
    rangePreview,
    rangePreviewing,
    rangeSubmitting,
    selectedRangeJobCodes,
    rangeVersionIdsText,
    rangeForm,
    isCurrentRangePreview,
    operationDrawerOpen,
    currentOperation,
    operationActing,
    canApproveOperation,
    canCancelOperation,
    submitDrawerOpen,
    submitting,
    submissionOutcomeUnknown,
    submitForm,
    selectedJobCodes,
    selectedOutputJobCodes,
    selectedVersionIds,
    jobCodeOptions,
    loadingJobCodes,
    loadingOutputVersions,
    outputVersionOptions,
    versionIdsText,
    preview,
    previewing,
    previewPage,
    previewPageSize,
    replayScopeLabel,
    replayActionLabel,
    previewPageEntries,
    detailDrawerOpen,
    currentSession,
    entries,
    retryingEntryId,
    loadingEntries,
    entriesStatusFilter,
    entriesStatusItems,
    approving,
    cancelling,
    canApprove,
    canCancel,
    scopeTagType,
    statusTagType,
    operationProgressPct,
    entryStatusTagType,
    progressPct,
    progressStatus,
    openRangeDrawer,
    previewRange,
    submitRange,
    openOperation,
    refreshOperation,
    approveOperation,
    cancelOperation,
    doPreview,
    doSubmit,
    onSubmitClose,
    openSubmitDrawer,
    openDetail,
    openChildSession,
    reloadCurrent,
    loadEntries,
    retryFailedSubmission,
    doApprove,
    doCancel,
  } = useBatchDayReplay()
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
  :deep(.cell-mute) {
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
