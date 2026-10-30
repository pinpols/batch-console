<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canMutateConfig" type="primary" @click="openUploadDialog">
          {{ t('fileList.uploadAction') }}
        </el-button>
        <el-button @click="$router.push('/files/arrival-groups')">
          {{ t('fileList.arrivalGroupsAction') }}
        </el-button>
      </template>
    </PageHeader>

    <FileSummaryCards
      :summary="summary"
      :active-summary-key="activeSummaryKey"
      @today="applyTodayFilter"
      @status="applyStatusFilter"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        pagination-mode="cursor"
        :has-more="fileHasMore"
        :has-prev="fileCursorStack.length > 0"
        column-config-id="file-list"
        :column-defs="columnDefs"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="resetFileCursorAndLoad"
        @cursor-next="nextFilePage"
        @cursor-prev="prevFilePage"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('fileList.fileName')">
              <el-input
                class="query-w-220"
                v-model="filters.fileName"
                clearable
                :placeholder="t('fileList.fileNamePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.fileId')">
              <el-input
                class="query-w-120"
                v-model="filters.fileId"
                clearable
                :placeholder="t('fileList.fileIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.bizDate')">
              <DateRangePresetPicker v-model="bizDateRange" type="daterange" default-preset="7d" />
            </el-form-item>
            <el-form-item :label="t('fileList.trace')">
              <TraceIdInput
                class="query-w-240"
                v-model="filters.traceId"
                :placeholder="t('fileList.tracePlaceholder')"
              />
            </el-form-item>
            <!-- 照设计 dump:渠道/状态两个下拉右置,紧邻搜索按钮 -->
            <el-form-item :label="t('fileList.bizType')">
              <MetaSelect
                class="query-w-160"
                v-model="filters.bizType"
                clearable
                filterable
                :placeholder="t('fileList.bizTypePlaceholder')"
                :options="bizTypeOptions"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.statusLabel')">
              <MetaSelect
                class="query-w-160"
                v-model="filters.fileStatus"
                clearable
                filterable
                enum-key="fileStatus"
                :placeholder="t('fileList.statusPlaceholder')"
                :options="fileStatusSelectOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('fileList.emptyTitle')"
            :description="t('fileList.emptyDescription')"
            :image-size="80"
          >
            <template #action>
              <el-button type="primary" @click="$router.push('/files/templates')">
                {{ t('fileList.emptyGoTemplates') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <template #default="{ isColVisible }">
          <el-table-column v-if="isColVisible('id')" prop="id" label="ID" width="90" />
          <!-- 照设计 dump 列序:文件名 / 渠道(→业务类型) / 大小(后端无,缺) / 状态 / 到达时间 / 操作 -->
          <!-- 文件名 = mono 强调色可点(点击开详情抽屉,对应 dump scpn accent + cursor:pointer) -->
          <el-table-column
            v-if="isColVisible('fileName')"
            prop="fileName"
            :label="t('fileList.fileName')"
            min-width="320"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span
                class="cell-link file-name-link"
                role="link"
                tabindex="0"
                @click="openDetail(row as ConsoleFileRecordResponse)"
                @keydown.enter="openDetail(row as ConsoleFileRecordResponse)"
              >
                {{ row.fileName }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('bizType')"
            prop="bizType"
            :label="t('fileList.bizType')"
            width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="cell-mono">{{ row.bizType }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('bizDate')"
            prop="bizDate"
            :label="t('fileList.bizDate')"
            width="110"
          >
            <template #default="{ row }">
              <span class="cell-mono">{{ row.bizDate }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="fileStatus" :label="t('fileList.statusLabel')" width="120">
            <template #default="{ row }">
              <StatusTag :value="String(row.fileStatus ?? '')" category="file" />
            </template>
          </el-table-column>
          <!-- 到达时间(file_record.created_at = 文件登记/到达时刻;dump 列名「到达时间」) -->
          <DatetimeColumn
            v-if="isColVisible('createdAt')"
            prop="createdAt"
            :label="t('fileList.colArrivedAt')"
            width="160"
          />
          <el-table-column
            v-if="isColVisible('traceId')"
            prop="traceId"
            :label="t('fileList.trace')"
            width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <router-link
                v-if="row.traceId"
                class="cell-link"
                :to="`/observability/trace?traceId=${row.traceId}`"
              >
                {{ row.traceId }}
              </router-link>
              <span v-else class="cell-empty">—</span>
            </template>
          </el-table-column>
          <!-- 照设计 dump:行内仅 1 个主操作「下载」+「⋯」更多;详情走文件名链接,低频操作全收进更多 -->
          <el-table-column
            :label="t('fileList.colActions')"
            width="170"
            align="right"
            fixed="right"
          >
            <template #default="{ row }">
              <RowActions
                :actions="rowActions(row as ConsoleFileRecordResponse)"
                :inline-limit="1"
              />
            </template>
          </el-table-column>
        </template>
      </ProTable>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('fileList.detailTitle')"
      size="800px"
    >
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="tenant_id">{{ detail.tenant_id ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="file_name">{{ detail.file_name ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="mime_type">{{ detail.mime_type ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="storage_type">{{
          detail.storage_type ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="storage_bucket">{{
          detail.storage_bucket ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="storage_path" :span="2">
          <span class="cell-mono">{{ detail.storage_path ?? '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="metadata_json" :span="2">
          <JsonPreview :data="detail.metadata_json ?? null" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('fileList.detailRawResponse')" :span="2">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="auditVisible" :title="t('fileList.auditTitle')" width="800px">
      <el-table
        v-loading="loading"
        :data="pagedAuditRows.records"
        border
        size="small"
        height="420"
        :empty-text="t('fileList.auditEmpty')"
        highlight-current-row
        class="console-table"
      >
        <DatetimeColumn prop="createdAt" :label="t('fileList.auditTime')" width="160" />
        <el-table-column
          prop="operationType"
          :label="t('fileList.auditOperationType')"
          width="120"
        />
        <el-table-column
          prop="operationResult"
          :label="t('fileList.auditOperationResult')"
          width="120"
        />
        <el-table-column prop="operatorType" :label="t('fileList.auditOperatorType')" width="110" />
        <el-table-column prop="operatorId" :label="t('fileList.auditOperatorId')" width="120" />
        <el-table-column
          prop="traceId"
          :label="t('fileList.trace')"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="evidenceRef"
          :label="t('fileList.auditEvidence')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detailSummary"
          :label="t('fileList.auditDetailSummary')"
          min-width="180"
        >
          <template #default="{ row }">
            <JsonPreviewPopover :data="row.detailSummary" />
          </template>
        </el-table-column>
      </el-table>
      <TablePagerBar
        :page="auditPage"
        :page-size="auditPageSize"
        :total="pagedAuditRows.total"
        @update:page="setAuditPage"
        @update:page-size="onAuditPageSize"
      />
    </el-dialog>

    <el-dialog
      v-model="uploadDialogVisible"
      :title="t('fileList.uploadTitle')"
      width="620px"
      :close-on-click-modal="!uploading"
      :close-on-press-escape="!uploading"
      :show-close="!uploading"
    >
      <el-alert
        :title="t('fileList.uploadScope', { tenant: uploadTenantId || tenant.tenantId })"
        type="info"
        :closable="false"
        show-icon
      />
      <el-form label-position="top" class="file-upload-form">
        <el-form-item :label="t('fileList.uploadChannel')" required>
          <el-select
            v-model="uploadChannelCode"
            filterable
            :loading="uploadChannelsLoading"
            :disabled="uploading || uploadTenantId !== tenant.tenantId"
            :placeholder="t('fileList.uploadChannelPlaceholder')"
          >
            <el-option
              v-for="channel in enabledUploadChannels"
              :key="channel.channelCode"
              :label="
                channel.channelName
                  ? `${channel.channelName} (${channel.channelCode})`
                  : channel.channelCode
              "
              :value="channel.channelCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('fileList.uploadTarget')">
          <el-select
            v-model="uploadTargetKey"
            clearable
            filterable
            :loading="uploadTargetsLoading"
            :disabled="uploading || uploadTenantId !== tenant.tenantId"
            :placeholder="t('fileList.uploadTargetPlaceholder')"
            @change="onUploadTargetChange"
          >
            <el-option
              v-for="target in uploadTargets"
              :key="uploadTargetKeyFor(target)"
              :label="uploadTargetLabel(target)"
              :value="uploadTargetKeyFor(target)"
            />
          </el-select>
        </el-form-item>
        <template v-if="selectedUploadTarget">
          <el-form-item :label="t('fileList.uploadBizDate')" required>
            <el-date-picker
              v-model="uploadBizDate"
              type="date"
              value-format="YYYY-MM-DD"
              :disabled="uploading || uploadTenantId !== tenant.tenantId"
              :placeholder="t('fileList.uploadBizDatePlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('fileList.uploadRequiredFiles')" required>
            <el-input
              v-model="uploadRequiredFilesText"
              type="textarea"
              :rows="2"
              :disabled="uploading || uploadTenantId !== tenant.tenantId"
              :placeholder="t('fileList.uploadRequiredFilesPlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('fileList.uploadBundleTemplate')" required>
            <el-select
              v-model="uploadBundleTemplateCode"
              filterable
              :loading="uploadTargetsLoading"
              :disabled="uploading || uploadTenantId !== tenant.tenantId"
              :placeholder="t('fileList.uploadBundleTemplatePlaceholder')"
            >
              <el-option
                v-for="template in enabledUploadTemplates"
                :key="template.templateCode"
                :label="
                  template.templateName
                    ? `${template.templateName} (${template.templateCode})`
                    : template.templateCode
                "
                :value="template.templateCode"
              />
            </el-select>
          </el-form-item>
          <el-alert
            class="file-upload-alert"
            type="info"
            :closable="false"
            show-icon
            :title="t('fileList.uploadGroupHint')"
          />
        </template>
        <el-form-item :label="t('fileList.uploadFile')" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            :file-list="uploadFileList"
            :disabled="uploading || uploadTenantId !== tenant.tenantId"
            :on-change="onUploadFileChange"
            :on-remove="onUploadFileRemove"
          >
            <el-button :disabled="uploading || uploadTenantId !== tenant.tenantId">
              {{ t('fileList.uploadChooseFile') }}
            </el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="uploadChannelsError"
        class="file-upload-alert"
        type="error"
        :closable="false"
        show-icon
        :title="t('fileList.uploadChannelsFailed')"
      />
      <el-alert
        v-if="uploadTargetsError"
        class="file-upload-alert"
        type="error"
        :closable="false"
        show-icon
        :title="t('fileList.uploadTargetsFailed')"
      />
      <el-alert
        v-if="uploadErrorKey"
        class="file-upload-alert"
        type="error"
        :closable="false"
        show-icon
        :title="t(`fileList.${uploadErrorKey}`, { id: uploadErrorFileId ?? '—' })"
      />
      <el-alert
        v-if="uploadResult"
        class="file-upload-alert"
        type="success"
        :closable="false"
        show-icon
        :title="
          t('fileList.uploadVerified', {
            id: uploadResult.id,
            name: uploadResult.fileName,
            status: uploadResult.fileStatus,
          })
        "
      />
      <p v-if="uploadStageKey" class="file-upload-stage" role="status">
        {{ t(`fileList.${uploadStageKey}`) }}
      </p>
      <template #footer>
        <el-button :disabled="uploading" @click="uploadDialogVisible = false">
          {{ t('common.close') }}
        </el-button>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!canSubmitManualUpload"
          @click="submitManualUpload"
        >
          {{ t('fileList.uploadSubmit') }}
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { UploadFile, UploadUserFile } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { fileApi } from '@/api/file'
  import { queryFileChannels } from '@/api/fileChannelsQuery'
  import { useTenantStore } from '@/stores/tenant'
  import { useRoute } from 'vue-router'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { usePermission } from '@/composables/usePermission'

  const route = useRoute()
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import FileSummaryCards from './components/FileSummaryCards.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import JsonPreviewPopover from '@/components/common/JsonPreviewPopover.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { recentBusinessDateRange, todayBusinessDate } from '@/utils/datetime'
  import { createIdempotencyKey } from '@/utils/idempotency'
  import { getMetaBizTypes } from '@/api/meta'
  import { listFileTemplates } from '@/api/system'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type {
    ConsoleAuditLogResponse,
    ConsoleFileRecordDetailResponse,
    ConsoleFileRecordResponse,
    ConsoleFileChannelResponse,
    ConsoleFileTemplateResponse,
    ConsoleFileSummaryResponse,
    ConsoleFileUploadBindingRequest,
    ConsoleFileUploadTargetResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const { canMutateConfig } = usePermission()
  const uploadDialogVisible = ref(false)
  const uploadChannelsLoading = ref(false)
  const uploadTargetsLoading = ref(false)
  const uploadChannelsError = ref(false)
  const uploadTargetsError = ref(false)
  const uploadTenantId = ref('')
  const uploadChannels = ref<ConsoleFileChannelResponse[]>([])
  const uploadTargets = ref<ConsoleFileUploadTargetResponse[]>([])
  const uploadTemplates = ref<ConsoleFileTemplateResponse[]>([])
  const uploadChannelCode = ref('')
  const uploadTargetKey = ref('')
  const uploadBizDate = ref('')
  const uploadRequiredFilesText = ref('')
  const uploadBundleTemplateCode = ref('')
  const uploadFileList = ref<UploadUserFile[]>([])
  const selectedUploadFile = ref<File | null>(null)
  const uploading = ref(false)
  const uploadStageKey = ref('')
  const uploadErrorKey = ref('')
  const uploadErrorFileId = ref<number | null>(null)
  const uploadResult = ref<ConsoleFileRecordResponse | null>(null)
  const enabledUploadChannels = computed(() =>
    uploadChannels.value.filter(
      (row): row is ConsoleFileChannelResponse & { channelCode: string } =>
        row.enabled === true && typeof row.channelCode === 'string' && row.channelCode.length > 0,
    ),
  )
  const enabledUploadTemplates = computed(() =>
    uploadTemplates.value.filter(
      (row): row is ConsoleFileTemplateResponse & { templateCode: string } =>
        row.enabled === true &&
        row.templateType === 'IMPORT' &&
        typeof row.templateCode === 'string' &&
        row.templateCode.length > 0,
    ),
  )
  const selectedUploadTarget = computed(
    () =>
      uploadTargets.value.find((target) => uploadTargetKeyFor(target) === uploadTargetKey.value) ??
      null,
  )
  const uploadRequiredFileNames = computed(() =>
    uploadRequiredFilesText.value
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean),
  )
  const canSubmitManualUpload = computed(() => {
    const baseReady =
      canMutateConfig.value &&
      Boolean(uploadChannelCode.value) &&
      Boolean(selectedUploadFile.value) &&
      uploadTenantId.value === tenant.tenantId
    if (!baseReady) return false
    if (!selectedUploadTarget.value) return true
    return Boolean(
      uploadBizDate.value &&
      uploadRequiredFileNames.value.includes(selectedUploadFile.value?.name ?? '') &&
      uploadBundleTemplateCode.value &&
      enabledUploadTemplates.value.some(
        (template) => template.templateCode === uploadBundleTemplateCode.value,
      ),
    )
  })
  let uploadChannelRequestSequence = 0

  watch(
    () => tenant.tenantId,
    () => {
      uploadChannelRequestSequence += 1
      uploadChannels.value = []
      uploadTargets.value = []
      uploadTemplates.value = []
      if (uploading.value) return
      uploadDialogVisible.value = false
      uploadTenantId.value = ''
      uploadChannelCode.value = ''
      uploadTargetKey.value = ''
      uploadBizDate.value = ''
      uploadRequiredFilesText.value = ''
      uploadBundleTemplateCode.value = ''
      selectedUploadFile.value = null
      uploadFileList.value = []
    },
    { flush: 'sync' },
  )

  async function openUploadDialog() {
    if (!canMutateConfig.value || !tenant.tenantId) return
    uploadDialogVisible.value = true
    uploadTenantId.value = tenant.tenantId
    uploadChannelCode.value = ''
    uploadTargetKey.value = ''
    uploadBizDate.value = ''
    uploadRequiredFilesText.value = ''
    uploadBundleTemplateCode.value = ''
    uploadFileList.value = []
    selectedUploadFile.value = null
    uploadErrorKey.value = ''
    uploadErrorFileId.value = null
    uploadResult.value = null
    uploadStageKey.value = ''
    uploadChannelsError.value = false
    uploadTargetsError.value = false
    const sequence = ++uploadChannelRequestSequence
    uploadChannelsLoading.value = true
    uploadTargetsLoading.value = true
    try {
      const [channelsResult, targetsResult, templatesResult] = await Promise.allSettled([
        queryFileChannels(uploadTenantId.value),
        fileApi.listManualUploadTargets(uploadTenantId.value),
        listFileTemplates(uploadTenantId.value),
      ])
      if (sequence !== uploadChannelRequestSequence || uploadTenantId.value !== tenant.tenantId)
        return
      if (channelsResult.status === 'fulfilled') uploadChannels.value = channelsResult.value ?? []
      else uploadChannelsError.value = true
      if (targetsResult.status === 'fulfilled') uploadTargets.value = targetsResult.value ?? []
      else uploadTargetsError.value = true
      if (templatesResult.status === 'fulfilled')
        uploadTemplates.value = templatesResult.value ?? []
      else uploadTargetsError.value = true
    } finally {
      if (sequence === uploadChannelRequestSequence) {
        uploadChannelsLoading.value = false
        uploadTargetsLoading.value = false
      }
    }
  }

  function uploadTargetKeyFor(target: ConsoleFileUploadTargetResponse) {
    return `${target.calendarCode}:${target.workflowDefinitionId}:${target.fileGroupCode}`
  }

  function uploadTargetLabel(target: ConsoleFileUploadTargetResponse) {
    return `${target.fileGroupCode} · ${target.workflowCode} · ${target.workflowName}`
  }

  function onUploadTargetChange(targetKey: string | undefined) {
    if (!targetKey) {
      uploadBizDate.value = ''
      uploadRequiredFilesText.value = ''
      uploadBundleTemplateCode.value = ''
      return
    }
    uploadBizDate.value = todayBusinessDate()
    uploadRequiredFilesText.value = selectedUploadFile.value?.name ?? ''
    uploadBundleTemplateCode.value = ''
  }

  function onUploadFileChange(file: UploadFile, files: UploadUserFile[]) {
    uploadFileList.value = files.slice(-1)
    selectedUploadFile.value = file.raw ?? null
    if (selectedUploadTarget.value && !uploadRequiredFilesText.value.trim()) {
      uploadRequiredFilesText.value = file.name
    }
    uploadErrorKey.value = ''
    uploadResult.value = null
  }

  function onUploadFileRemove() {
    uploadFileList.value = []
    selectedUploadFile.value = null
  }

  function validateUploadSession(
    session: import('@/types/console-api').ConsoleFilePresignUploadResponse,
    tenantId: string,
  ) {
    if (
      session.uploadMode !== 'APP_MANAGED' ||
      session.uploadMethod !== 'PUT' ||
      session.contentField !== 'file' ||
      !Number.isSafeInteger(session.fileId) ||
      session.fileId <= 0
    ) {
      return false
    }
    try {
      const uploadUrl = new URL(session.uploadUrl, 'https://console.invalid')
      return (
        uploadUrl.origin === 'https://console.invalid' &&
        uploadUrl.pathname === `/api/console/files/${session.fileId}/content` &&
        uploadUrl.searchParams.get('tenantId') === tenantId
      )
    } catch {
      return false
    }
  }

  async function submitManualUpload() {
    const selectedFile = selectedUploadFile.value
    const channelCode = uploadChannelCode.value
    const tenantId = uploadTenantId.value
    const target = selectedUploadTarget.value
    if (
      !canSubmitManualUpload.value ||
      !selectedFile ||
      !channelCode ||
      tenantId !== tenant.tenantId
    )
      return
    const binding: ConsoleFileUploadBindingRequest | undefined = target
      ? {
          calendarCode: target.calendarCode,
          workflowDefinitionId: target.workflowDefinitionId,
          fileGroupCode: target.fileGroupCode,
          bizDate: uploadBizDate.value,
          requiredFileNames: uploadRequiredFileNames.value,
          bundleTemplateCode: uploadBundleTemplateCode.value,
        }
      : undefined
    const targetKey = uploadTargetKey.value
    const confirmed = await ElMessageBox.confirm(
      t('fileList.uploadConfirmText', {
        name: selectedFile.name,
        channel: channelCode,
        target: target
          ? `${target.fileGroupCode} / ${uploadBizDate.value}`
          : t('fileList.uploadTargetNone'),
      }),
      t('fileList.uploadConfirmTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      },
    ).then(
      () => true,
      () => false,
    )
    if (
      !confirmed ||
      tenantId !== tenant.tenantId ||
      selectedUploadFile.value !== selectedFile ||
      uploadChannelCode.value !== channelCode ||
      uploadTargetKey.value !== targetKey
    )
      return
    uploading.value = true
    uploadErrorKey.value = ''
    uploadErrorFileId.value = null
    uploadResult.value = null
    uploadStageKey.value = 'uploadStageCreating'
    let fileId: number | null = null
    try {
      const session = await fileApi.presignUpload(
        tenantId,
        channelCode,
        selectedFile.name,
        createIdempotencyKey(),
        binding,
      )
      fileId = session.fileId
      uploadErrorFileId.value = fileId
      if (!validateUploadSession(session, tenantId)) throw new Error('invalid upload session')

      uploadStageKey.value = 'uploadStageTransferring'
      await fileApi.uploadContent(fileId, tenantId, selectedFile, createIdempotencyKey())

      uploadStageKey.value = 'uploadStageConfirming'
      await fileApi.confirmFileArrival(fileId, tenantId, createIdempotencyKey())

      uploadStageKey.value = 'uploadStageVerifying'
      const reread = await fileApi.list({
        tenantId,
        fileId: String(fileId),
        page: 1,
        pageSize: 15,
      })
      const persisted = reread.records.find((record) => record.id === fileId)
      if (!persisted) throw new Error('uploaded file record was not visible after confirmation')
      uploadResult.value = persisted
      uploadStageKey.value = binding ? 'uploadStageGroupComplete' : 'uploadStageComplete'
      if (tenantId === tenant.tenantId) {
        void load().catch(() => undefined)
        void loadSummary()
      }
    } catch {
      uploadStageKey.value = ''
      if (fileId == null) uploadErrorKey.value = 'uploadSessionUnknown'
      else uploadErrorKey.value = 'uploadStepUnconfirmed'
      uploadErrorFileId.value = fileId
    } finally {
      uploading.value = false
    }
  }

  // 列设置:状态/操作列始终显示;工程字段(ID/Trace)默认隐藏。
  // 到达时间(createdAt)照设计 dump 是主表列,默认显示。
  const columnDefs = computed(() => [
    { key: 'id', label: 'ID', defaultHidden: true },
    { key: 'fileName', label: t('fileList.fileName') },
    { key: 'bizType', label: t('fileList.bizType') },
    { key: 'bizDate', label: t('fileList.bizDate') },
    { key: 'createdAt', label: t('fileList.colArrivedAt') },
    { key: 'traceId', label: t('fileList.trace'), defaultHidden: true },
  ])

  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleFileRecordResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const fileCursor = ref<string | null>(null)
  const fileNextCursor = ref<string | null>(null)
  const fileCursorStack = ref<(string | null)[]>([])
  const fileHasMore = ref(false)
  const detailVisible = ref(false)
  const auditVisible = ref(false)
  const detail = ref<ConsoleFileRecordDetailResponse | null>(null)
  const auditRows = ref<ConsoleAuditLogResponse[]>([])
  const auditPage = ref(1)
  const auditPageSize = ref(15)
  // 列表筛选默认锚到「近 7 天 + 全部状态」:文件 biz_date 多为 T-1 及更早,默认只看
  // "今天单日"(start==end)常空屏(当天尚无文件到达时尤甚)。近 7 天更贴合运维诉求;
  // 需精确单日用户自行收窄。
  function recentRange(days = 7): [string, string] {
    return recentBusinessDateRange(days)
  }
  const initialBizRange = recentRange()
  const bizDateRange = ref<[string, string] | null>(initialBizRange)
  // 接受深链 ?fileId=xxx / ?traceId=xxx 跳入,自动套用筛选
  const initialFileId = (route.query.fileId as string) || ''
  const initialTraceId = (route.query.traceId as string) || ''
  const filters = reactive({
    tenantId: tenant.tenantId,
    fileStatus: '',
    bizType: '',
    fileName: '',
    traceId: initialTraceId,
    fileId: initialFileId,
    startDate: initialBizRange[0],
    endDate: initialBizRange[1],
    arrivalToday: false,
  })

  // 行操作:1 主 + 4 次,折进"更多"避免一行 5 个 plain 按钮
  function rowActions(row: ConsoleFileRecordResponse): RowAction[] {
    const actions: RowAction[] = [
      {
        key: 'detail',
        label: t('fileList.actionDetail'),
        primary: true,
        onClick: () => openDetail(row),
      },
      { key: 'audit', label: t('fileList.actionAudit'), onClick: () => openAudit(row) },
      { key: 'download', label: t('fileList.actionDownload'), onClick: () => downloadFile(row) },
    ]
    if (canMutateConfig.value) {
      actions.push({
        key: 'redispatch',
        label: t('fileList.actionRedispatch'),
        divided: true,
        onClick: () => redispatchFile(row),
      })
      actions.push({
        key: 'archive',
        label: t('fileList.actionArchive'),
        danger: true,
        onClick: () => archiveFile(row),
      })
    }
    return actions
  }

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const fileStatusSelectOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'fileStatus'))

  const bizTypeOptions = ref<{ value: string; label: string }[]>([])

  async function loadBizTypes() {
    try {
      bizTypeOptions.value = await getMetaBizTypes(tenant.tenantId)
    } catch {
      bizTypeOptions.value = []
    }
  }

  // 领域汇总卡:今日到达 / 待处理(RECEIVED) / 已处理(LOADED) / 失败(FAILED)。
  const summary = ref<ConsoleFileSummaryResponse | null>(null)

  async function loadSummary() {
    try {
      summary.value = await fileApi.summary(filters.tenantId || tenant.tenantId)
    } catch {
      summary.value = null
    }
  }

  // 当前筛选命中哪张卡(用于高亮激活态)。
  const activeSummaryKey = computed(() => {
    if (filters.fileStatus === 'RECEIVED') return 'RECEIVED'
    if (filters.fileStatus === 'LOADED') return 'LOADED'
    if (filters.fileStatus === 'FAILED') return 'FAILED'
    const todaySummaryIsActive = !filters.fileStatus && filters.arrivalToday
    if (todaySummaryIsActive) {
      return 'today'
    }
    return ''
  })

  // 点状态卡:套用状态筛选并清日期锚(汇总为租户全量,清日期才与卡上数字口径一致);
  // 再次点同一张 = 取消,恢复默认近 7 天。
  function applyStatusFilter(status: string) {
    return runSearch(async () => {
      const active = filters.fileStatus === status
      filters.arrivalToday = false
      filters.fileStatus = active ? '' : status
      if (active) {
        const r = recentRange()
        filters.startDate = r[0]
        filters.endDate = r[1]
        bizDateRange.value = r
      } else {
        filters.startDate = ''
        filters.endDate = ''
        bizDateRange.value = null
      }
      page.value = 1
      resetFileCursor()
      await load()
    })
  }

  // 点「今日到达」:按服务端时区的到达日筛选并清业务日期;再次点恢复默认近 7 天。
  function applyTodayFilter() {
    return runSearch(async () => {
      if (activeSummaryKey.value === 'today') {
        filters.arrivalToday = false
        const r = recentRange()
        filters.startDate = r[0]
        filters.endDate = r[1]
        bizDateRange.value = r
      } else {
        filters.fileStatus = ''
        filters.startDate = ''
        filters.endDate = ''
        bizDateRange.value = null
        filters.arrivalToday = true
      }
      page.value = 1
      resetFileCursor()
      await load()
    })
  }

  const pagedAuditRows = computed(() =>
    toPageResult(auditRows.value, auditPage.value, auditPageSize.value),
  )

  function setAuditPage(p: number) {
    auditPage.value = p
  }

  function onAuditPageSize(s: number) {
    auditPageSize.value = s
    auditPage.value = 1
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const pr = await fileApi.list({
        ...filters,
        // 顺序后置:filters.tenantId 为空时回退到当前租户(避免 spread 覆盖)
        tenantId: filters.tenantId || tenant.tenantId,
        page: page.value,
        pageSize: pageSize.value,
        cursor: fileCursor.value,
      })
      rows.value = pr.records
      total.value = pr.total
      fileNextCursor.value = pr.nextCursor ?? null
      fileHasMore.value = Boolean(pr.hasMore)
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function resetFileCursor() {
    fileCursor.value = null
    fileNextCursor.value = null
    fileCursorStack.value = []
    fileHasMore.value = false
    page.value = 1
  }

  async function resetFileCursorAndLoad() {
    resetFileCursor()
    await load()
  }

  async function nextFilePage() {
    if (!fileHasMore.value || !fileNextCursor.value) return
    fileCursorStack.value.push(fileCursor.value)
    fileCursor.value = fileNextCursor.value
    page.value += 1
    await load()
  }

  async function prevFilePage() {
    const prev = fileCursorStack.value.pop()
    fileCursor.value = prev ?? null
    page.value = Math.max(1, page.value - 1)
    await load()
  }

  function onSearch() {
    return runSearch(async () => {
      // traceId 是全局唯一键,搜它时清掉默认的今日日期锚定——否则别的业务日的文件被日期挡掉
      // 搜不到(与实例列表 JobInstanceList 同款修复)。
      if (filters.traceId?.trim()) {
        filters.arrivalToday = false
        filters.startDate = ''
        filters.endDate = ''
        bizDateRange.value = null
      }
      page.value = 1
      resetFileCursor()
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      const t = recentRange()
      filters.tenantId = tenant.tenantId
      filters.fileStatus = ''
      filters.bizType = ''
      filters.fileName = ''
      filters.traceId = ''
      filters.fileId = ''
      filters.arrivalToday = false
      filters.startDate = t[0]
      filters.endDate = t[1]
      bizDateRange.value = t
      page.value = 1
      resetFileCursor()
      await load()
    })
  }

  async function openDetail(row: ConsoleFileRecordResponse) {
    detail.value = await fileApi.detail(row.id, row.tenantId ?? tenant.tenantId)
    detailVisible.value = true
  }

  async function openAudit(row: ConsoleFileRecordResponse) {
    auditPage.value = 1
    auditRows.value = await fileApi.audit(row.id, row.tenantId ?? tenant.tenantId)
    auditVisible.value = true
  }

  watch([auditRows, auditPageSize], () => {
    const total = auditRows.value.length
    const max = Math.max(1, Math.ceil(total / auditPageSize.value) || 1)
    if (auditPage.value > max) auditPage.value = max
  })

  async function downloadFile(row: ConsoleFileRecordResponse) {
    try {
      const res = await fileApi.download(row.id, row.tenantId ?? tenant.tenantId)
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = row.fileName || `file-${row.id}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      ElMessage.error(t('fileList.downloadFail'))
    }
  }

  async function redispatchFile(row: ConsoleFileRecordResponse) {
    try {
      await ElMessageBox.confirm(
        t('fileList.redispatchConfirm', { id: row.id, name: row.fileName }),
        t('fileList.redispatchTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await fileApi.redispatch({ tenantId: row.tenantId ?? tenant.tenantId, fileId: row.id })
      ElMessage.success(t('fileList.redispatchSuccess'))
      await load()
      void loadSummary()
    } catch {
      /* cancel */
    }
  }

  async function archiveFile(row: ConsoleFileRecordResponse) {
    try {
      await confirmDanger({
        verb: t('fileList.archiveVerb'),
        target: t('fileList.archiveTarget', { name: row.fileName }),
        consequence: t('fileList.archiveConsequence'),
        irreversible: false,
      })
      await fileApi.archive({ tenantId: row.tenantId ?? tenant.tenantId, fileId: row.id })
      ElMessage.success(t('fileList.archiveSuccess'))
      await load()
      void loadSummary()
    } catch {
      /* cancel */
    }
  }

  watch(bizDateRange, (value) => {
    if (value) filters.arrivalToday = false
    filters.startDate = value?.[0] ?? ''
    filters.endDate = value?.[1] ?? ''
  })

  useTenantReload(() => {
    page.value = 1
    void load()
    void loadBizTypes()
    void loadSummary()
  })
</script>

<style scoped>
  .file-upload-form {
    margin-top: 16px;
  }

  .file-upload-form :deep(.el-select) {
    width: 100%;
  }

  .file-upload-alert {
    margin-top: 12px;
  }

  .file-upload-stage {
    margin: 12px 0 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }
</style>
