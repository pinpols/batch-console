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
            <div class="upload-zone">
              <el-icon class="upload-zone__icon" :size="36"><Upload /></el-icon>
              <p class="upload-zone__title">{{ t('tenantPackageImportWizard.uploadTitle') }}</p>
              <p class="upload-zone__desc">{{ t('tenantPackageImportWizard.uploadDesc') }}</p>
              <div class="upload-zone__toolbar">
                <div class="upload-zone__toolbar-left">
                  <el-button link type="primary" :loading="tplLoading" @click="doDownloadTemplate">
                    {{ t('tenantPackageImportWizard.btnDownloadTemplate') }}
                  </el-button>
                  <span class="upload-zone__toolbar-dot" aria-hidden="true">•</span>
                  <el-button link type="primary" :loading="exportLoading" @click="doExport">
                    {{ t('tenantPackageImportWizard.btnExportCurrent') }}
                  </el-button>
                </div>
                <div class="upload-zone__toolbar-right">
                  <el-upload
                    :auto-upload="false"
                    :limit="1"
                    :on-change="onFile"
                    :show-file-list="false"
                  >
                    <el-button class="upload-zone__ghost-btn" type="primary" plain size="large">
                      {{ t('excelMaintenanceWizard.btnPickFile') }}
                    </el-button>
                  </el-upload>
                  <el-button
                    class="upload-zone__primary-btn"
                    type="primary"
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
                  {{ previewStats.invalid }}
                </el-descriptions-item>
              </el-descriptions>
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
                <div class="excel-wizard__table-caption">
                  {{ t('excelMaintenanceWizard.rowIssuesCaption') }}
                </div>
                <el-table
                  class="wizard-stretch console-table"
                  :data="issueRows"
                  max-height="320"
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
                    prop="messages"
                    :label="t('excelMaintenanceWizard.colMessages')"
                    min-width="200"
                  />
                </el-table>
              </div>
            </template>
          </div>

          <div v-show="step === 2" class="excel-wizard__panel">
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
              <el-button type="danger" size="large" :disabled="!uploadToken" @click="doApply">
                {{ t('excelMaintenanceWizard.btnApply') }}
              </el-button>
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
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft, ArrowRight, Document, Upload, WarningFilled } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import {
    tenantPackageDownloadTemplate,
    tenantPackageExport,
    tenantPackageUpload,
    tenantPackagePreview,
    tenantPackageDownloadPreviewWorkbook,
    tenantPackageApply,
  } from '@/api/excelDomains'
  import { useImportWizard } from '@/composables/useImportWizard'
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
    onFile,
    triggerBlobDownload,
  } = useImportWizard()

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
    try {
      await ElMessageBox.confirm(
        t('tenantPackageImportWizard.applyConfirmText'),
        t('tenantPackageImportWizard.applyConfirmTitle'),
        { type: 'warning' },
      )
      await tenantPackageApply(uploadToken.value, {})
      ElMessage.success(t('tenantPackageImportWizard.appliedToast'))
    } catch {
      /* cancel */
    }
  }
</script>

<style scoped>
  :deep(.tenant-pkg-page) {
    gap: 8px;
  }

  .excel-wizard {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    width: 100%;
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

  .upload-zone {
    width: 100%;
    padding: 16px 12px;
    text-align: center;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-card-lg);
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
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
    max-width: 720px;
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
    background: color-mix(in srgb, var(--color-primary) 8%, transparent 92%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border) 82%);
    box-shadow: 0 8px 18px rgb(15 23 42 / 8%);
    transition:
      transform 0.16s ease,
      box-shadow 0.18s ease,
      background 0.18s ease,
      border-color 0.18s ease;
  }

  .upload-zone__toolbar-left :deep(.el-button.is-link:hover) {
    transform: translateY(-1px);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent 88%);
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border) 70%);
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

  .upload-zone__toolbar-right :deep(.el-upload) {
    width: auto;
  }

  .upload-zone__ghost-btn,
  .upload-zone__primary-btn {
    min-height: 44px;
    border-radius: 12px;
    font-weight: 650;
    padding: 0 18px;
  }

  .upload-zone__ghost-btn {
    border-color: color-mix(in srgb, var(--color-primary) 26%, var(--color-border) 74%);
    background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card) 94%);
    box-shadow: 0 8px 18px rgb(15 23 42 / 10%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease;
  }

  .upload-zone__ghost-btn:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border) 62%);
    background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card) 91%);
    box-shadow: 0 12px 26px rgb(15 23 42 / 14%);
  }

  .upload-zone__ghost-btn:active {
    transform: translateY(0);
  }

  .upload-zone__primary-btn {
    border: none;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 74%, #ffffff 26%) 0%,
      color-mix(in srgb, #0f5ed9 64%, #ffffff 36%) 100%
    );
    box-shadow: 0 12px 30px rgb(59 130 246 / 18%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }

  .upload-zone__primary-btn:hover {
    transform: translateY(-1px);
    filter: saturate(1.03);
    box-shadow: 0 16px 40px rgb(59 130 246 / 22%);
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
</style>
