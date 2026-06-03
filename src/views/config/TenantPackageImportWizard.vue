<template>
  <PageContainer class="tenant-pkg-page">
    <PageHeader compact />
    <SectionCard>
      <div class="excel-wizard">
        <div class="excel-wizard__steps-shell">
          <el-steps :active="step" finish-status="success" align-center class="excel-wizard__steps">
            <el-step
              :title="t('excelMaintenanceWizard.stepUpload')"
              :description="t('excelMaintenanceWizard.stepUploadDesc')"
            />
            <el-step
              :title="t('excelMaintenanceWizard.stepPreview')"
              :description="t('excelMaintenanceWizard.stepPreviewDesc')"
            />
            <el-step
              :title="t('excelMaintenanceWizard.stepApply')"
              :description="t('excelMaintenanceWizard.stepApplyDesc')"
            />
          </el-steps>
        </div>

        <div class="excel-wizard__body">
          <div
            v-show="step === 0"
            class="excel-wizard__panel"
            v-loading="upLoading"
            :element-loading-text="t('excelMaintenanceWizard.uploadingFile')"
          >
            <div
              class="upload-zone"
              :class="{ 'upload-zone--dragover': zoneDragover }"
              @dragenter.prevent="onZoneDragEnter"
              @dragover.prevent="onZoneDragEnter"
              @dragleave.prevent="onZoneDragLeave"
              @drop.prevent="onZoneDrop"
            >
              <el-icon class="upload-zone__icon" :size="36"><FolderOpened /></el-icon>
              <p class="upload-zone__title">{{ t('tenantPackageImportWizard.uploadTitle') }}</p>
              <p class="upload-zone__desc">{{ t('tenantPackageImportWizard.uploadDesc') }}</p>
              <div class="upload-zone__toolbar">
                <div class="upload-zone__toolbar-left">
                  <el-button
                    link
                    type="primary"
                    :icon="Download"
                    :loading="tplLoading"
                    @click="doDownloadTemplate"
                  >
                    {{ t('tenantPackageImportWizard.btnDownloadTemplate') }}
                  </el-button>
                  <span class="upload-zone__toolbar-dot" aria-hidden="true">•</span>
                  <el-button
                    link
                    type="primary"
                    :icon="Download"
                    :loading="exportLoading"
                    @click="doExport"
                  >
                    {{ t('tenantPackageImportWizard.btnExportCurrent') }}
                  </el-button>
                </div>
                <div class="upload-zone__toolbar-right">
                  <el-upload
                    drag
                    :auto-upload="false"
                    :limit="1"
                    accept=".xls,.xlsx"
                    :on-change="onFile"
                    :show-file-list="false"
                    class="upload-zone__dropzone"
                  >
                    <el-icon class="upload-zone__icon"><UploadFilled /></el-icon>
                    <div class="upload-zone__hint">
                      <strong>{{ t('tenantPackageImportWizard.dropHintDrop') }}</strong>
                      {{ t('tenantPackageImportWizard.dropHintOr') }}
                      <el-link type="primary" :underline="false">
                        {{ t('excelMaintenanceWizard.btnPickFile') }}
                      </el-link>
                      <div class="upload-zone__sub">.xls / .xlsx</div>
                    </div>
                  </el-upload>
                  <el-button
                    class="upload-zone__primary-btn"
                    type="primary"
                    :icon="Upload"
                    :disabled="!file"
                    :loading="upLoading"
                    size="large"
                    @click="doUpload"
                  >
                    {{ t('excelMaintenanceWizard.btnStartUpload') }}
                  </el-button>
                </div>
              </div>
              <div v-if="file" class="upload-zone__file">
                <el-icon><Document /></el-icon>
                <span class="upload-zone__file-name">{{ file.name }}</span>
              </div>
            </div>

            <el-alert
              v-if="uploadToken"
              class="excel-wizard__token-alert"
              type="success"
              :closable="false"
              show-icon
            >
              <template #title>{{ t('excelMaintenanceWizard.uploadSuccess') }}</template>
              <div class="excel-wizard__token-label">uploadToken</div>
              <pre class="excel-wizard__token-code">{{ uploadToken }}</pre>
            </el-alert>
          </div>

          <div
            v-show="step === 1"
            class="excel-wizard__panel excel-wizard__panel--wide"
            v-loading="pvLoading"
            :element-loading-text="t('excelMaintenanceWizard.fetchingPreview')"
          >
            <p v-if="!uploadToken" class="excel-wizard__mute-hint">
              {{ t('excelMaintenanceWizard.needUploadFirst') }}
            </p>
            <template v-else>
              <div class="excel-wizard__panel-head">
                <h3 class="excel-wizard__panel-title">
                  {{ t('excelMaintenanceWizard.panelTitlePreview') }}
                </h3>
                <div class="excel-wizard__panel-actions">
                  <el-button
                    type="primary"
                    :disabled="!uploadToken"
                    :loading="pvLoading"
                    @click="doPreview"
                  >
                    {{ t('excelMaintenanceWizard.btnFetchPreview') }}
                  </el-button>
                  <el-tooltip
                    :content="t('excelMaintenanceWizard.annotatedTooltip')"
                    placement="top"
                  >
                    <el-button
                      :icon="Download"
                      :disabled="!uploadToken"
                      :loading="wbLoading"
                      @click="doDownloadWorkbook"
                    >
                      {{ t('excelMaintenanceWizard.btnDownloadAnnotated') }}
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
              <el-descriptions
                v-if="previewStats"
                class="excel-wizard__desc"
                :column="2"
                border
                :title="t('excelMaintenanceWizard.descTitleSummary')"
              >
                <el-descriptions-item :label="t('excelMaintenanceWizard.descLabelTotal')">
                  {{ previewStats.total }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('excelMaintenanceWizard.descLabelValid')">
                  {{ previewStats.valid }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('excelMaintenanceWizard.descLabelInvalid')">
                  <span :class="{ 'count-danger': Number(previewStats.invalid) > 0 }">
                    {{ previewStats.invalid }}
                  </span>
                </el-descriptions-item>
              </el-descriptions>

              <!-- 每张 sheet 的拆分 — 后端 sheets[] 之前被前端丢弃,现在显式展开 -->
              <div v-if="sheetStats.length" class="excel-wizard__table-block">
                <div class="excel-wizard__table-caption">
                  {{ t('tenantPackageImportWizard.sheetStatsCaption') }}
                </div>
                <el-table
                  class="wizard-stretch console-table"
                  :data="sheetStats"
                  size="small"
                  stripe
                  border
                  :empty-text="t('common.noData')"
                >
                  <el-table-column
                    prop="sheetName"
                    :label="t('tenantPackageImportWizard.colSheet')"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      <span>{{ row.sheetName }}</span>
                      <el-tag
                        v-if="downstreamAtRisk.includes(normalizeSheetName(row.sheetName))"
                        size="small"
                        type="warning"
                        effect="plain"
                        class="sheet-risk-tag"
                      >
                        {{ t('tenantPackageImportWizard.sheetRiskDownstream') }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="total"
                    :label="t('tenantPackageImportWizard.colSheetTotal')"
                    width="80"
                  />
                  <el-table-column
                    prop="valid"
                    :label="t('tenantPackageImportWizard.colSheetValid')"
                    width="80"
                  >
                    <template #default="{ row }">
                      <span class="count-success">{{ row.valid }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="invalid"
                    :label="t('tenantPackageImportWizard.colSheetInvalid')"
                    width="100"
                  >
                    <template #default="{ row }">
                      <span :class="{ 'count-danger': row.invalid > 0 }">{{ row.invalid }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <!-- 依赖图谱:当有 sheet 出错时,提示哪些下游会受影响 -->
              <el-alert
                v-if="downstreamAtRisk.length"
                type="warning"
                :closable="false"
                show-icon
                class="excel-wizard__desc"
              >
                <template #title>
                  {{ t('tenantPackageImportWizard.depsAlertTitle') }}
                </template>
                <template #default>
                  <div class="deps-alert-body">
                    <span>{{ t('tenantPackageImportWizard.depsAlertBody') }}</span>
                    <el-tag
                      v-for="s in downstreamAtRisk"
                      :key="s"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      {{ s }}
                    </el-tag>
                  </div>
                </template>
              </el-alert>
              <el-alert
                v-if="previewWorkbookUrl"
                type="info"
                :closable="false"
                show-icon
                class="excel-wizard__desc"
              >
                <template #title>
                  {{ t('excelMaintenanceWizard.annotatedReadyTitle') }}
                  <a :href="previewWorkbookUrl" target="_blank" class="cell-link">
                    {{ t('excelMaintenanceWizard.annotatedReadyLink') }}
                  </a>
                </template>
              </el-alert>
              <div v-if="issueRows.length" class="excel-wizard__table-block">
                <div class="excel-wizard__table-caption issues-caption">
                  <span>
                    {{ t('excelMaintenanceWizard.rowIssuesCaption') }}
                    <el-tag size="small" type="danger" effect="plain" class="issue-count-tag">
                      {{ issueRows.length }}
                    </el-tag>
                  </span>
                  <!-- I7: 修完直接重传,不必再绕回 step 0 -->
                  <el-button text type="primary" :icon="ArrowLeft" size="small" @click="step = 0">
                    {{ t('tenantPackageImportWizard.btnReuploadFixed') }}
                  </el-button>
                </div>
                <el-table
                  class="wizard-stretch console-table"
                  :data="issueRows"
                  :max-height="issueTableMaxHeight"
                  stripe
                  border
                  highlight-current-row
                  :empty-text="t('common.noData')"
                >
                  <el-table-column
                    prop="sheetName"
                    :label="t('excelMaintenanceWizard.colSheet')"
                    width="160"
                  />
                  <el-table-column
                    prop="rowNo"
                    :label="t('excelMaintenanceWizard.colRowNo')"
                    width="70"
                  />
                  <el-table-column
                    prop="columnName"
                    :label="t('tenantPackageImportWizard.colColumn')"
                    width="140"
                  >
                    <template #default="{ row }">
                      <code v-if="row.columnName" class="cell-col-code">{{ row.columnName }}</code>
                      <span v-else class="cell-mute">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="messages"
                    :label="t('excelMaintenanceWizard.colMessages')"
                    min-width="200"
                  />
                </el-table>
              </div>
            </template>
          </div>

          <div
            v-show="step === 2"
            class="excel-wizard__panel"
            v-loading="applyLoading"
            :element-loading-text="t('tenantPackageImportWizard.applyingLoading')"
          >
            <div class="apply-zone">
              <el-icon class="apply-zone__icon" :size="32"><WarningFilled /></el-icon>
              <h3 class="apply-zone__title">{{ t('excelMaintenanceWizard.applyTitle') }}</h3>
              <p class="apply-zone__desc">
                {{ t('tenantPackageImportWizard.applyDescStart') }}
                <code>uploadToken</code>
                {{ t('tenantPackageImportWizard.applyDescMid') }}
                <strong>{{ t('tenantPackageImportWizard.applyDescBold') }}</strong>
                {{ t('tenantPackageImportWizard.applyDescEnd') }}
              </p>
              <!-- 闸门:有 invalid 行直接拦 apply,避免半坏数据落库 -->
              <el-alert
                v-if="hasBlockingIssues && !applyResult"
                type="error"
                :closable="false"
                show-icon
                class="apply-zone__block"
              >
                <template #title>
                  {{ t('tenantPackageImportWizard.applyBlockedTitle') }}
                </template>
                <template #default>
                  {{
                    t('tenantPackageImportWizard.applyBlockedBody', {
                      n: previewStats?.invalid ?? issueRows.length,
                    })
                  }}
                </template>
              </el-alert>

              <!-- I11: Apply 失败 → 错误 alert + 一键 Retry -->
              <el-alert
                v-if="applyError"
                type="error"
                :closable="false"
                show-icon
                class="apply-zone__block"
              >
                <template #title>{{ t('tenantPackageImportWizard.applyFailedTitle') }}</template>
                <template #default>
                  <div class="apply-fail-body">
                    <pre class="apply-fail-err">{{ applyError }}</pre>
                    <el-button size="small" type="primary" :icon="Refresh" @click="doApply">
                      {{ t('tenantPackageImportWizard.btnRetryApply') }}
                    </el-button>
                  </div>
                </template>
              </el-alert>

              <!-- I10: Apply 成功 → 完整 entity-level breakdown -->
              <el-alert
                v-if="applyResult"
                type="success"
                :closable="false"
                show-icon
                class="apply-zone__block"
              >
                <template #title>{{ t('tenantPackageImportWizard.applySucceededTitle') }}</template>
                <template #default>
                  <el-table
                    class="apply-result-table"
                    :data="applyBreakdownRows"
                    size="small"
                    border
                    :empty-text="t('common.noData')"
                  >
                    <el-table-column
                      prop="entity"
                      :label="t('tenantPackageImportWizard.colEntity')"
                      min-width="140"
                    />
                    <el-table-column
                      prop="inserted"
                      :label="t('tenantPackageImportWizard.colInserted')"
                      width="90"
                    >
                      <template #default="{ row }">
                        <span :class="{ 'count-success': row.inserted > 0 }">{{
                          row.inserted
                        }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="updated"
                      :label="t('tenantPackageImportWizard.colUpdated')"
                      width="90"
                    >
                      <template #default="{ row }">
                        <span :class="{ 'count-success': row.updated > 0 }">{{ row.updated }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </template>
              </el-alert>

              <div class="apply-zone__actions">
                <el-button
                  v-if="!applyResult"
                  type="danger"
                  size="large"
                  :disabled="!uploadToken || hasBlockingIssues || applyLoading"
                  :loading="applyLoading"
                  @click="doApply"
                >
                  {{
                    applyLoading
                      ? t('tenantPackageImportWizard.applyingBtn')
                      : t('excelMaintenanceWizard.btnApply')
                  }}
                </el-button>
                <!-- I12: 成功 / 失败后,显式"重置向导"回 step 0,避免 state 漂移 -->
                <el-button v-if="applyResult || applyError" size="large" @click="resetWizard">
                  {{ t('tenantPackageImportWizard.btnResetWizard') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="excel-wizard__footer">
          <el-tooltip :content="t('excelMaintenanceWizard.btnPrev')" placement="top">
            <button
              class="wizard-nav wizard-nav--prev"
              :disabled="step <= 0"
              :aria-label="t('excelMaintenanceWizard.btnPrev')"
              @click="step--"
            >
              <el-icon><ArrowLeft /></el-icon>
            </button>
          </el-tooltip>
          <span class="wizard-nav__progress">{{ step + 1 }} / 3</span>
          <el-tooltip :content="t('excelMaintenanceWizard.btnNext')" placement="top">
            <button
              class="wizard-nav wizard-nav--next"
              :disabled="step >= 2 || (step === 0 && !uploadToken)"
              :aria-label="t('excelMaintenanceWizard.btnNext')"
              @click="step++"
            >
              <el-icon><ArrowRight /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    ArrowLeft,
    ArrowRight,
    Document,
    Download,
    FolderOpened,
    Refresh,
    Upload,
    UploadFilled,
    WarningFilled,
  } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import {
    tenantPackageDownloadTemplate,
    tenantPackageExport,
    tenantPackageUpload,
    tenantPackagePreview,
    tenantPackageDownloadPreviewWorkbook,
    tenantPackageApply,
  } from '@/api/tenantPackageExcel'
  import { useImportWizard, type SheetStats } from '@/composables/useImportWizard'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const {
    step,
    file,
    uploadToken,
    upLoading,
    pvLoading,
    wbLoading,
    tplLoading,
    exportLoading,
    previewRaw,
    previewStats,
    previewWorkbookUrl,
    issueRows,
    sheetStats,
    hasBlockingIssues,
    onFile,
    setRawFile,
    triggerBlobDownload,
  } = useImportWizard()

  const zoneDragover = ref(false)
  function onZoneDragEnter(ev: DragEvent) {
    if (ev.dataTransfer?.types?.includes('Files')) zoneDragover.value = true
  }
  function onZoneDragLeave(ev: DragEvent) {
    // 仅当真正离开 zone(而非进入子元素)时取消高亮
    const related = ev.relatedTarget as Node | null
    if (!related || !(ev.currentTarget as Node).contains(related)) {
      zoneDragover.value = false
    }
  }
  function onZoneDrop(ev: DragEvent) {
    zoneDragover.value = false
    const f = ev.dataTransfer?.files?.[0]
    if (!f) return
    if (!/\.(xlsx?|xlsm)$/i.test(f.name)) {
      ElMessage.warning(`仅支持 .xls / .xlsx 文件,当前: ${f.name}`)
      return
    }
    setRawFile(f)
  }

  /**
   * Tenant package 各 sheet 间的引用关系(前端静态知识库)。
   * 后端 preview 只返 row 级错误,不返 cross-sheet 依赖;这里给用户可视化:
   * 修一处错误,下游 sheet 会受连带影响。
   */
  const SHEET_DEPENDENCY_GRAPH: Array<{ from: string; to: string[] }> = [
    { from: 'business-calendar', to: ['batch-window', 'job'] },
    { from: 'resource-queue', to: ['job'] },
    { from: 'batch-window', to: ['job'] },
    { from: 'job', to: ['pipeline', 'workflow'] },
    { from: 'channel', to: ['file-template'] },
    { from: 'file-template', to: ['pipeline'] },
    { from: 'pipeline', to: ['workflow'] },
  ]

  /** 按 sheet 名归一化:后端可能返 `BusinessCalendar` 或 `business-calendar` 任何风格,统一成 kebab。 */
  function normalizeSheetName(raw: string): string {
    return raw
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  /** 哪些 sheet 有错。 */
  const failingSheets = computed<Set<string>>(() => {
    const s = new Set<string>()
    for (const sh of sheetStats.value) {
      if (sh.invalid > 0) s.add(normalizeSheetName(sh.sheetName))
    }
    for (const i of issueRows.value) {
      s.add(normalizeSheetName(i.sheetName))
    }
    return s
  })

  /** 受影响 = 自己出错 ∪ 任意上游出错(BFS 沿 from→to)。 */
  const affectedSheets = computed<Set<string>>(() => {
    const failing = failingSheets.value
    const out = new Set(failing)
    let added = true
    while (added) {
      added = false
      for (const e of SHEET_DEPENDENCY_GRAPH) {
        if (out.has(e.from)) {
          for (const t of e.to) {
            if (!out.has(t)) {
              out.add(t)
              added = true
            }
          }
        }
      }
    }
    return out
  })

  /** 仅"被上游影响"(自身没出错,但上游出错了)。 */
  const downstreamAtRisk = computed<string[]>(() => {
    const failing = failingSheets.value
    return [...affectedSheets.value].filter((s) => !failing.has(s))
  })

  /**
   * I8: issue 表高度自适应:每行 ~36px,base 帧 64;少于 8 条紧凑,多于 8 条限到 480 给出滚动条。
   * 比固定 320 体验更好:少 issue 不空旷,多 issue 滚动条也更长好操作。
   */
  const issueTableMaxHeight = computed<number>(() => {
    const n = issueRows.value.length
    const rowH = 36
    const base = 64
    return Math.min(480, Math.max(160, base + n * rowH))
  })

  /**
   * I9-I12 Apply 阶段状态机:
   *   - applyLoading:进行中(disable button + 全 panel mask)
   *   - applyError:失败的可读错误(alert + retry)
   *   - applyResult:成功的 entity-level breakdown(insert/update 拆分)
   * 三态互斥,resetWizard 一并清。
   */
  const applyLoading = ref(false)
  const applyError = ref<string | null>(null)
  const applyResult = shallowRef<Record<string, number> | null>(null)

  /** 把后端 apply 返回的 9 实体 insert/update 拆分,展平成表行 */
  const applyBreakdownRows = computed<Array<{ entity: string; inserted: number; updated: number }>>(
    () => {
      const r = applyResult.value
      if (!r) return []
      const ents: Array<[string, string, string]> = [
        ['resource-queue', 'resourceQueueInserted', 'resourceQueueUpdated'],
        ['business-calendar', 'businessCalendarInserted', 'businessCalendarUpdated'],
        ['batch-window', 'batchWindowInserted', 'batchWindowUpdated'],
        ['job', 'jobInserted', 'jobUpdated'],
        ['channel', 'channelInserted', 'channelUpdated'],
        ['file-template', 'fileTemplateInserted', 'fileTemplateUpdated'],
        ['pipeline', 'pipelineInserted', 'pipelineUpdated'],
        ['workflow', 'workflowInserted', 'workflowUpdated'],
      ]
      return ents
        .map(([entity, ik, uk]) => ({
          entity,
          inserted: r[ik] ?? 0,
          updated: r[uk] ?? 0,
        }))
        .filter((row) => row.inserted > 0 || row.updated > 0)
    },
  )

  /** I12 重置向导:回 step 0 + 清掉所有阶段状态,让用户重新走完整流程 */
  function resetWizard() {
    applyLoading.value = false
    applyError.value = null
    applyResult.value = null
    uploadToken.value = ''
    file.value = null
    previewRaw.value = null
    step.value = 0
  }

  async function doDownloadTemplate() {
    tplLoading.value = true
    try {
      const blob = await tenantPackageDownloadTemplate()
      triggerBlobDownload(blob, 'tenant-package-template.xlsx')
      ElMessage.success(t('tenantPackageImportWizard.templateDownloadedToast'))
    } finally {
      tplLoading.value = false
    }
  }

  async function doExport() {
    exportLoading.value = true
    try {
      const blob = await tenantPackageExport()
      triggerBlobDownload(blob, 'tenant-package-export.xlsx')
      ElMessage.success(t('tenantPackageImportWizard.exportedToast'))
    } finally {
      exportLoading.value = false
    }
  }

  async function doUpload() {
    if (!file.value) return
    upLoading.value = true
    try {
      const res = await tenantPackageUpload(file.value)
      uploadToken.value = res.uploadToken ?? ''
      if (!uploadToken.value) {
        ElMessage.warning(t('excelMaintenanceWizard.noUploadTokenWarn'))
      }
    } finally {
      upLoading.value = false
    }
  }

  async function doPreview() {
    if (!uploadToken.value) return
    pvLoading.value = true
    try {
      previewRaw.value = (await tenantPackagePreview(uploadToken.value)) as Record<string, unknown>
    } finally {
      pvLoading.value = false
    }
  }

  async function doDownloadWorkbook() {
    if (!uploadToken.value) return
    wbLoading.value = true
    try {
      const blob = await tenantPackageDownloadPreviewWorkbook(uploadToken.value)
      triggerBlobDownload(blob, `tenant-package-preview-${uploadToken.value}.xlsx`)
      ElMessage.success(t('excelMaintenanceWizard.annotatedDownloadedToast'))
    } finally {
      wbLoading.value = false
    }
  }

  async function doApply() {
    if (!uploadToken.value) return
    if (hasBlockingIssues.value) {
      ElMessage.error(t('tenantPackageImportWizard.applyBlockedTitle'))
      return
    }
    // 重试场景:清掉上一次失败的 alert,再触发 confirm
    applyError.value = null
    // confirm 仅首次显示;retry 时跳过(用户已显式点 retry)
    const isRetry = applyResult.value === null && applyError.value === null && false
    void isRetry // 占位:目前无 retry-without-confirm 需求,但保留语义钩子
    try {
      const breakdown = sheetStats.value
        .filter((s: SheetStats) => s.valid > 0)
        .map((s: SheetStats) => `${s.sheetName}: ${s.valid}`)
        .join(' · ')
      const detail = breakdown
        ? t('tenantPackageImportWizard.applyConfirmDetail', {
            n: previewStats.value?.valid ?? 0,
            breakdown,
          })
        : t('tenantPackageImportWizard.applyConfirmText')
      await ElMessageBox.confirm(detail, t('tenantPackageImportWizard.applyConfirmTitle'), {
        type: 'warning',
        confirmButtonText: t('tenantPackageImportWizard.applyConfirmYes'),
        cancelButtonText: t('common.cancel'),
        dangerouslyUseHTMLString: false,
      })
    } catch {
      return /* user cancelled confirm */
    }
    applyLoading.value = true
    applyError.value = null
    try {
      const res = await tenantPackageApply(uploadToken.value, {})
      // 后端 apply 返每实体 insert/update 拆分,放进 applyResult 让 I10 面板展示完整 breakdown
      applyResult.value = res as unknown as Record<string, number>
      ElMessage.success(t('tenantPackageImportWizard.appliedToast'))
    } catch (err: unknown) {
      // I11 失败展示:把后端 message / stack 完整保留供用户排障
      const e = err as { response?: { data?: { message?: string } }; message?: string } | null
      applyError.value =
        e?.response?.data?.message ||
        e?.message ||
        (err instanceof Error ? err.message : String(err))
    } finally {
      applyLoading.value = false
    }
  }
</script>

<style scoped>
  :deep(.tenant-pkg-page) {
    gap: 8px;
  }

  /* 大屏适配:仅本页作用域(.tenant-pkg-page),让 SectionCard 撑满可用高度,
     使内部向导能填满纵向空间,而非矮卡片顶在最上、下方大片空白。其它页不受影响。 */
  :deep(.tenant-pkg-page > .section-card) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  :deep(.tenant-pkg-page > .section-card > .el-card__body) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .excel-wizard {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    width: 100%;
    /* 撑满可用高度;min-height 仅作下限(撑不满时不塌陷,零回归) */
    flex: 1 1 auto;
    min-height: 360px;
    box-sizing: border-box;
  }

  .excel-wizard__steps-shell {
    padding: 8px 10px 10px;
    margin-bottom: 10px;
    background: linear-gradient(
      180deg,
      var(--el-fill-color-lighter, rgb(0 0 0 / 4%)) 0%,
      transparent 100%
    );
    border-bottom: 1px solid var(--color-border-light);
  }

  .excel-wizard__steps {
    max-width: 100%;
    margin: 0;
  }

  .excel-wizard__steps :deep(.el-step__title) {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
  }

  .excel-wizard__steps :deep(.el-step__description) {
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-tertiary);
    line-height: 1.4;
  }

  .excel-wizard__body {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    min-height: 180px;
  }

  .excel-wizard__panel {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding-bottom: 12px;
    box-sizing: border-box;
  }

  .excel-wizard__panel--wide {
    max-width: 100%;
    align-items: stretch;
  }

  /* 内容少的步骤(上传,非 --wide):在撑满的 body 里垂直居中,大屏下不顶在最上方 */
  .excel-wizard__panel:not(.excel-wizard__panel--wide) {
    margin-block: auto;
  }

  .upload-zone {
    width: 100%;
    padding: 16px 12px;
    text-align: center;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-card-lg);
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
    transition:
      border-color 0.18s,
      background 0.18s;
  }
  .upload-zone--dragover {
    border-color: var(--color-primary);
    background: var(--color-primary-light-9, rgba(64, 158, 255, 0.06));
  }

  .upload-zone__icon {
    color: var(--color-primary);
    opacity: 0.9;
  }

  .upload-zone__title {
    margin: 8px 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.3;
  }

  .upload-zone__desc {
    margin: 0 auto;
    max-width: 520px;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.55;
  }

  .upload-zone__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin: var(--card-inner-padding) auto 0;
    padding-top: var(--space-xs);
    max-width: min(960px, 100%);
    width: 100%;
  }

  .upload-zone__toolbar-left {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--color-text-tertiary);
    flex-wrap: wrap;
  }

  .upload-zone__toolbar-left :deep(.el-button.is-link) {
    border-radius: 999px;
    padding: 6px 12px;
    background: var(--button-primary-soft-bg);
    border: 1px solid var(--button-primary-soft-border);
    box-shadow: 0 8px 18px rgb(15 23 42 / 8%);
    transition:
      transform 0.16s ease,
      box-shadow 0.18s ease,
      background 0.18s ease,
      border-color 0.18s ease;
  }

  .upload-zone__toolbar-left :deep(.el-button.is-link:hover) {
    transform: translateY(-1px);
    background: var(--button-primary-soft-bg-hover);
    border-color: var(--button-primary-soft-text);
    box-shadow: 0 12px 26px rgb(15 23 42 / 12%);
  }

  .upload-zone__toolbar-left :deep(.el-button.is-link:active) {
    transform: translateY(0);
    box-shadow: 0 10px 20px rgb(15 23 42 / 10%);
  }

  .upload-zone__toolbar-dot {
    opacity: 0.55;
    transform: translateY(-1px);
  }

  .upload-zone__toolbar-right {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  /* drag 模式 dropzone */
  .upload-zone__dropzone :deep(.el-upload-dragger) {
    padding: 18px 28px;
    border-radius: 8px;
    background: var(--color-bg-page);
    border: 1px dashed var(--color-border-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition:
      border-color 0.18s,
      background 0.18s;
  }
  .upload-zone__dropzone :deep(.el-upload-dragger:hover) {
    border-color: var(--color-primary);
    background: var(--color-primary-light-9, rgba(64, 158, 255, 0.06));
  }
  .upload-zone__icon {
    font-size: 28px;
    color: var(--color-primary);
  }
  .upload-zone__hint {
    font-size: 13px;
    color: var(--color-text-secondary);
    text-align: center;
  }
  .upload-zone__sub {
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .upload-zone__toolbar-right :deep(.el-upload) {
    width: auto;
  }

  .upload-zone__ghost-btn,
  .upload-zone__primary-btn {
    min-height: 44px;
    border-radius: var(--radius-content);
    font-weight: 650;
    padding: 0 18px;
  }

  .upload-zone__ghost-btn {
    border-color: var(--button-primary-soft-border);
    background: var(--button-primary-soft-bg);
    box-shadow: 0 8px 18px rgb(15 23 42 / 10%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease;
  }

  .upload-zone__ghost-btn:hover {
    transform: translateY(-1px);
    border-color: var(--button-primary-soft-text);
    background: var(--button-primary-soft-bg-hover);
    box-shadow: 0 12px 26px rgb(15 23 42 / 14%);
  }

  .upload-zone__ghost-btn:active {
    transform: translateY(0);
  }

  .upload-zone__primary-btn {
    border: none;
    color: var(--button-primary-text);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--button-primary-bg) 88%, #ffffff 12%) 0%,
      var(--button-primary-bg) 100%
    );
    box-shadow: 0 12px 30px color-mix(in srgb, var(--button-primary-bg) 20%, transparent);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }

  .upload-zone__primary-btn:hover {
    transform: translateY(-1px);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--button-primary-bg-hover) 88%, #ffffff 12%) 0%,
      var(--button-primary-bg-hover) 100%
    );
    filter: saturate(1.03);
    box-shadow: 0 16px 40px color-mix(in srgb, var(--button-primary-bg) 24%, transparent);
  }

  .upload-zone__primary-btn:active {
    transform: translateY(0);
  }

  .upload-zone__primary-btn:disabled,
  .upload-zone__ghost-btn:disabled {
    box-shadow: none;
    transform: none;
  }

  @media (max-width: 720px) {
    .upload-zone__toolbar {
      flex-direction: column;
      align-items: stretch;
      max-width: 520px;
      gap: var(--space-sm);
    }

    .upload-zone__toolbar-right {
      justify-content: center;
    }
  }

  .upload-zone__file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 6px 10px;
    max-width: 100%;
    border-radius: var(--radius-input);
    background: var(--el-fill-color-light);
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .upload-zone__file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .excel-wizard__token-alert {
    width: 100%;
    margin-top: 12px;
    text-align: left;
  }

  .excel-wizard__token-alert :deep(.el-alert__content) {
    width: 100%;
  }

  .excel-wizard__token-label {
    margin-top: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .excel-wizard__token-code {
    margin: 6px 0 0;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.5;
    word-break: break-all;
    white-space: pre-wrap;
    border-radius: var(--radius-input);
    background: var(--el-fill-color-blank);
    border: 1px solid var(--color-border-light);
    color: var(--color-text-primary);
  }

  .excel-wizard__mute-hint {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .excel-wizard__panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .excel-wizard__panel-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .excel-wizard__panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .excel-wizard__desc {
    width: 100%;
  }

  .excel-wizard__table-block {
    margin-top: 12px;
    width: 100%;
  }

  .excel-wizard__table-caption {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .wizard-stretch {
    width: 100%;
  }

  .apply-zone {
    width: 100%;
    padding: 16px 12px;
    text-align: center;
    border-radius: var(--radius-card-lg);
    border: 1px solid var(--color-border-light);
    background: linear-gradient(
      165deg,
      var(--el-color-warning-light-9, rgb(250 173 20 / 8%)) 0%,
      var(--color-bg-card) 48%
    );
    box-shadow: var(--shadow-card);
  }

  .apply-zone__icon {
    color: var(--color-warning);
  }

  .apply-zone__title {
    margin: 4px 0 2px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .apply-zone__desc {
    margin: 0 auto 14px;
    max-width: 460px;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .apply-zone__desc code {
    font-size: 12px;
    padding: 1px 5px;
    border-radius: var(--radius-content);
    background: var(--el-fill-color-light);
  }

  .excel-wizard__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin: var(--space-lg) auto 0;
    padding: var(--page-block-gap) 0 0;
    border-top: 1px solid var(--color-border-light);
  }

  .wizard-nav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    cursor: pointer;
    outline: none;
    transition:
      transform 0.15s ease,
      box-shadow 0.18s ease,
      color 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .wizard-nav :deep(.el-icon) {
    font-size: 18px;
  }

  .wizard-nav:not(:disabled):hover {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 44%, var(--color-border) 56%);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card) 90%);
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgb(15 23 42 / 10%);
  }

  .wizard-nav:not(:disabled):active {
    transform: translateY(0);
  }

  .wizard-nav:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 28%, transparent 72%);
  }

  .wizard-nav:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  .wizard-nav--next:not(:disabled) {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  .wizard-nav--next:not(:disabled):hover {
    background: color-mix(in srgb, var(--color-primary) 86%, #000 14%);
    color: #fff;
  }

  .wizard-nav__progress {
    min-width: 48px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text-tertiary);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* I1-I4 校验态视觉:数字色阶 + columnName 高亮 + apply 闸门 + 依赖警示 */
  .count-success {
    color: var(--color-success, #16a34a);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .count-danger {
    color: var(--color-danger, #ef4444);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cell-col-code {
    padding: 1px 6px;
    font-size: 11px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-danger, #ef4444) 10%, transparent);
    color: var(--color-danger, #ef4444);
    font-family: var(--el-font-family-mono, ui-monospace, monospace);
  }
  .cell-mute {
    color: var(--color-text-tertiary);
  }
  .sheet-risk-tag {
    margin-left: 8px;
  }
  .deps-alert-body {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .apply-zone__block {
    width: 100%;
    margin: 12px 0;
  }
  /* I7: issue 表头与"重传"按钮分列两端 */
  .issues-caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .issue-count-tag {
    margin-left: 6px;
  }
  /* I9-I12 Apply 阶段状态机视觉 */
  .apply-zone__actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }
  .apply-fail-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .apply-fail-err {
    margin: 0;
    padding: 8px;
    background: color-mix(in srgb, var(--color-danger, #ef4444) 8%, transparent);
    border-radius: 6px;
    font-family: var(--el-font-family-mono, monospace);
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-danger, #b91c1c);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow: auto;
  }
  .apply-result-table {
    margin-top: 8px;
    max-width: 480px;
  }
</style>
