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
                      <el-link type="primary" underline="never">
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
                  <div v-if="file" class="upload-zone__file">
                    <el-icon><Document /></el-icon>
                    <span class="upload-zone__file-name">{{ file.name }}</span>
                  </div>
                </div>
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
                  <div class="sample-template-control">
                    <el-select
                      v-model="selectedSampleScenarios"
                      size="small"
                      multiple
                      collapse-tags
                      collapse-tags-tooltip
                      :max-collapse-tags="1"
                      :placeholder="t('tenantPackageImportWizard.scenarioPlaceholder')"
                    >
                      <el-option
                        v-for="option in scenarioOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                    <el-button
                      link
                      type="primary"
                      :icon="Download"
                      :loading="sampleTplLoading"
                      class="sample-template-control__button"
                      @click="doDownloadSampleTemplate"
                    >
                      {{ t('tenantPackageImportWizard.btnDownloadSampleTemplate') }}
                    </el-button>
                  </div>
                  <el-button
                    link
                    type="primary"
                    :icon="Download"
                    :loading="exportLoading"
                    @click="doExport"
                  >
                    {{ t('tenantPackageImportWizard.btnExportCurrent') }}
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    :icon="BookOpen"
                    :loading="guideLoading"
                    @click="openGuideDrawer"
                  >
                    {{ t('tenantPackageImportWizard.btnFieldGuide') }}
                  </el-button>
                </div>
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
                  <el-button :icon="BookOpen" :loading="guideLoading" @click="openGuideDrawer">
                    {{ t('tenantPackageImportWizard.btnFieldGuide') }}
                  </el-button>
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
                <div class="excel-wizard__table-caption sheet-stats-caption">
                  <span>{{ t('tenantPackageImportWizard.sheetStatsCaption') }}</span>
                  <el-switch
                    v-model="showOnlyInvalidSheets"
                    size="small"
                    :disabled="!hasInvalidSheets"
                    :active-text="t('tenantPackageImportWizard.onlyInvalidSheets')"
                  />
                </div>
                <el-table
                  class="wizard-stretch console-table"
                  :data="displaySheetStats"
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
                  <a
                    :href="previewWorkbookUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cell-link"
                  >
                    {{ t('excelMaintenanceWizard.annotatedReadyLink') }}
                  </a>
                </template>
              </el-alert>
              <el-alert
                v-if="previewStats && !hasBlockingIssues"
                type="success"
                :closable="false"
                show-icon
                class="excel-wizard__desc"
              >
                <template #title>
                  {{ t('tenantPackageImportWizard.previewReadyTitle', { n: previewStats.valid }) }}
                </template>
                <template #default>
                  {{ t('tenantPackageImportWizard.previewReadyBody') }}
                </template>
              </el-alert>
              <div v-if="errorRows.length" class="excel-wizard__table-block">
                <div class="excel-wizard__table-caption issues-caption">
                  <span>
                    {{ t('tenantPackageImportWizard.errorRowsCaption') }}
                    <el-tag size="small" type="danger" effect="plain" class="issue-count-tag">
                      {{ errorRows.length }}
                    </el-tag>
                  </span>
                  <!-- 内联编辑改不动的(如跨行去重)仍可重传 -->
                  <el-button text type="primary" :icon="ArrowLeft" size="small" @click="step = 0">
                    {{ t('tenantPackageImportWizard.btnReuploadFixed') }}
                  </el-button>
                </div>
                <p class="excel-wizard__mute-hint error-rows-hint">
                  {{ t('tenantPackageImportWizard.errorRowsHint') }}
                </p>
                <el-table
                  class="wizard-stretch console-table"
                  :data="errorRows"
                  :row-key="rowKeyOf"
                  :max-height="issueTableMaxHeight"
                  stripe
                  border
                  :empty-text="t('common.noData')"
                >
                  <el-table-column type="expand">
                    <template #default="{ row }">
                      <div class="error-row-editor">
                        <el-alert
                          v-for="(msg, mi) in row.messages"
                          :key="mi"
                          type="error"
                          :closable="false"
                          show-icon
                          class="error-row-editor__msg"
                          :title="msg"
                        />
                        <el-form label-position="top" class="error-row-editor__form">
                          <el-form-item
                            v-for="col in columnsOf(row)"
                            :key="col"
                            :label="col"
                            class="error-row-editor__field"
                          >
                            <el-input
                              v-model="draftFor(row)[col]"
                              clearable
                              :placeholder="t('tenantPackageImportWizard.cellPlaceholder')"
                            />
                          </el-form-item>
                        </el-form>
                        <div class="error-row-editor__actions">
                          <el-button
                            type="primary"
                            :loading="patchSaving === rowKeyOf(row)"
                            :disabled="patchSaving !== null"
                            @click="saveRow(row)"
                          >
                            {{ t('tenantPackageImportWizard.btnSaveRow') }}
                          </el-button>
                          <el-button :disabled="patchSaving !== null" @click="resetDraft(row)">
                            {{ t('tenantPackageImportWizard.btnResetRow') }}
                          </el-button>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="sheetName"
                    :label="t('excelMaintenanceWizard.colSheet')"
                    width="180"
                  />
                  <el-table-column
                    prop="rowNo"
                    :label="t('excelMaintenanceWizard.colRowNo')"
                    width="80"
                  />
                  <el-table-column :label="t('excelMaintenanceWizard.colMessages')" min-width="240">
                    <template #default="{ row }">{{ row.messages.join('; ') }}</template>
                  </el-table-column>
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
                  <!-- 全 0(源为空或已是最新):空表会被误读为"渲染坏了",改显明确提示 -->
                  <div v-if="applyBreakdownRows.length === 0" class="apply-no-change">
                    {{ t('tenantPackageImportWizard.applyNoChanges') }}
                  </div>
                  <el-table
                    v-else
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
              :disabled="nextDisabled"
              :aria-label="t('excelMaintenanceWizard.btnNext')"
              @click="step++"
            >
              <el-icon><ArrowRight /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </div>
    </SectionCard>

    <el-drawer
      v-model="guideDrawerVisible"
      class="tenant-pkg-guide-drawer"
      :title="t('tenantPackageImportWizard.guideDrawerTitle')"
      size="78%"
      append-to-body
      destroy-on-close
    >
      <div class="guide-drawer">
        <el-alert type="info" show-icon :closable="false" class="guide-drawer__intro">
          <template #title>{{ t('tenantPackageImportWizard.guideDrawerIntroTitle') }}</template>
          <template #default>{{ t('tenantPackageImportWizard.guideDrawerIntroBody') }}</template>
        </el-alert>

        <div class="guide-drawer__filters">
          <el-input
            v-model="guideKeyword"
            clearable
            :prefix-icon="Search"
            :placeholder="t('tenantPackageImportWizard.guideSearchPlaceholder')"
          />
          <el-select
            v-model="guideSheetName"
            filterable
            :placeholder="t('tenantPackageImportWizard.guideSheetPlaceholder')"
          >
            <el-option
              v-for="sheet in guideSheets"
              :key="sheet.sheetName"
              :label="sheet.sheetName"
              :value="sheet.sheetName"
            />
          </el-select>
          <el-segmented v-model="guideLevelFilter" :options="guideLevelOptions" />
          <el-segmented v-model="selectedGuideScenario" :options="scenarioOptions" />
        </div>

        <div v-if="activeGuideSheet" class="guide-drawer__summary">
          <el-tag effect="plain">{{ activeGuideSheet.sheetName }}</el-tag>
          <span>{{ activeGuideSheet.appliesTo }}</span>
          <span>
            {{
              t('tenantPackageImportWizard.guideSheetSummary', {
                total: activeGuideSheet.columns.length,
                required: activeGuideRequiredCount,
              })
            }}
          </span>
        </div>

        <el-table
          v-loading="guideLoading"
          class="guide-drawer__table console-table"
          :data="filteredGuideColumns"
          stripe
          border
          size="small"
          :empty-text="t('common.noData')"
        >
          <el-table-column type="expand" width="42">
            <template #default="{ row }">
              <div class="guide-row-detail">
                <div>
                  <strong>{{ t('tenantPackageImportWizard.guideColFillExample') }}</strong>
                  <pre>{{ row.fillExample || row.example || '-' }}</pre>
                </div>
                <div>
                  <strong>{{ t('tenantPackageImportWizard.guideColAppliesTo') }}</strong>
                  <p>{{ row.appliesTo || '-' }}</p>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="columnName"
            :label="t('tenantPackageImportWizard.guideColColumn')"
            min-width="210"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="guide-column-name">
                <code>{{ row.columnName }}</code>
                <el-tag v-if="row.required" size="small" type="danger" effect="plain">
                  {{ t('tenantPackageImportWizard.guideRequired') }}
                </el-tag>
                <el-tag v-else size="small" effect="plain">
                  {{ t('tenantPackageImportWizard.guideOptional') }}
                </el-tag>
                <el-tag v-if="row.readOnly" size="small" type="info" effect="plain">
                  {{ t('tenantPackageImportWizard.guideReadOnly') }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="guideLevel"
            :label="t('tenantPackageImportWizard.guideColLevel')"
            width="100"
          />
          <el-table-column
            prop="format"
            :label="t('tenantPackageImportWizard.guideColFormat')"
            min-width="110"
          />
          <el-table-column
            prop="defaultBehavior"
            :label="t('tenantPackageImportWizard.guideColDefault')"
            min-width="220"
          />
          <el-table-column
            prop="description"
            :label="t('tenantPackageImportWizard.guideColDescription')"
            min-width="280"
            show-overflow-tooltip
          />
          <el-table-column
            prop="allowedValues"
            :label="t('tenantPackageImportWizard.guideColAllowed')"
            min-width="240"
          >
            <template #default="{ row }">
              <span>{{ row.allowedValues?.join(' / ') || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="example"
            :label="t('tenantPackageImportWizard.guideColExample')"
            min-width="180"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    FileText as Document,
    Download,
    FolderOpen as FolderOpened,
    RefreshCw as Refresh,
    Search,
    Upload,
    Upload as UploadFilled,
    TriangleAlert as WarningFilled,
  } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import {
    tenantPackageDownloadTemplate,
    tenantPackageDownloadSampleTemplate,
    tenantPackageExport,
    tenantPackageUpload,
    tenantPackagePreview,
    tenantPackageGuide,
    tenantPackageDownloadPreviewWorkbook,
    tenantPackagePatchRow,
    tenantPackageApply,
    type TenantPackageApplyResponse,
    type TenantPackageColumnGuide,
    type TenantPackageSampleScenario,
    type TenantPackageSheetGuide,
  } from '@/api/tenantPackageExcel'
  import {
    useImportWizard,
    type SheetStats,
    type PreviewErrorRow,
  } from '@/composables/useImportWizard'
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
    sheetStats,
    errorRows,
    hasBlockingIssues,
    onFile,
    setRawFile,
    triggerBlobDownload,
  } = useImportWizard()

  // 出错行内联编辑:每行一份草稿(按 sheet#rowNo 键),保存调 patch 端点回写 + 重校验
  const rowDrafts = reactive<Record<string, Record<string, string>>>({})
  const patchSaving = ref<string | null>(null)
  const showOnlyInvalidSheets = ref(false)
  const guideDrawerVisible = ref(false)
  const guideLoading = ref(false)
  const guideSheets = shallowRef<TenantPackageSheetGuide[]>([])
  const guideSheetName = ref('')
  const guideKeyword = ref('')
  const sampleTplLoading = ref(false)
  const selectedSampleScenarios = ref<TenantPackageSampleScenario[]>(['ALL'])
  const selectedGuideScenario = ref<TenantPackageSampleScenario>('ALL')
  const scenarioOptions = computed<Array<{ label: string; value: TenantPackageSampleScenario }>>(
    () => [
      { label: t('tenantPackageImportWizard.scenarioAll'), value: 'ALL' },
      { label: 'IMPORT', value: 'IMPORT' },
      { label: 'EXPORT', value: 'EXPORT' },
      { label: 'PROCESS', value: 'PROCESS' },
      { label: 'DISPATCH', value: 'DISPATCH' },
      { label: 'ATOMIC', value: 'ATOMIC' },
      { label: 'WORKFLOW', value: 'WORKFLOW' },
    ],
  )
  const guideLevelFilter = ref<'all' | 'required' | 'common' | 'advanced'>('all')
  const guideLevelOptions = computed(() => [
    { label: t('tenantPackageImportWizard.guideFilterAll'), value: 'all' },
    { label: t('tenantPackageImportWizard.guideFilterRequired'), value: 'required' },
    { label: t('tenantPackageImportWizard.guideFilterCommon'), value: 'common' },
    { label: t('tenantPackageImportWizard.guideFilterAdvanced'), value: 'advanced' },
  ])

  const activeGuideSheet = computed<TenantPackageSheetGuide | null>(() => {
    if (!guideSheets.value.length) return null
    return (
      guideSheets.value.find((sheet) => sheet.sheetName === guideSheetName.value) ??
      guideSheets.value[0] ??
      null
    )
  })

  const activeGuideRequiredCount = computed<number>(() => {
    return activeGuideSheet.value?.columns.filter((column) => column.required).length ?? 0
  })

  const filteredGuideColumns = computed<TenantPackageColumnGuide[]>(() => {
    const columns = activeGuideSheet.value?.columns ?? []
    const keyword = guideKeyword.value.trim().toLowerCase()
    const scenario = selectedGuideScenario.value
    return columns.filter((column) => {
      if (!guideColumnMatchesScenario(column, activeGuideSheet.value, scenario)) return false
      if (guideLevelFilter.value === 'required' && !column.required) return false
      if (guideLevelFilter.value === 'common' && column.guideLevel !== '常用') return false
      if (guideLevelFilter.value === 'advanced' && column.guideLevel !== '高级') return false
      if (!keyword) return true
      return [
        column.columnName,
        column.guideLevel,
        column.format,
        column.description,
        column.example,
        column.fillExample,
        column.defaultBehavior,
        column.appliesTo,
        ...(column.allowedValues ?? []),
      ]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(keyword))
    })
  })

  async function loadGuideIfNeeded() {
    if (guideSheets.value.length || guideLoading.value) return
    guideLoading.value = true
    try {
      const resp = await tenantPackageGuide()
      guideSheets.value = resp.sheets ?? []
      guideSheetName.value = guideSheets.value[0]?.sheetName ?? ''
    } finally {
      guideLoading.value = false
    }
  }

  async function openGuideDrawer() {
    guideDrawerVisible.value = true
    await loadGuideIfNeeded()
  }

  function guideColumnMatchesScenario(
    column: TenantPackageColumnGuide,
    sheet: TenantPackageSheetGuide | null,
    scenario: TenantPackageSampleScenario,
  ): boolean {
    if (scenario === 'ALL') return true
    const text = `${sheet?.appliesTo ?? ''} ${column.appliesTo ?? ''}`.toUpperCase()
    return text.includes('ALL') || text.includes(scenario)
  }

  function rowKeyOf(row: PreviewErrorRow): string {
    return `${row.sheetName}#${row.rowNo}`
  }

  function columnsOf(row: PreviewErrorRow): string[] {
    return Object.keys(row.values)
  }

  /** 懒初始化该行草稿(从后端 values 拷贝);返回可双向绑定的对象 */
  function draftFor(row: PreviewErrorRow): Record<string, string> {
    const key = rowKeyOf(row)
    if (!rowDrafts[key]) rowDrafts[key] = { ...row.values }
    return rowDrafts[key]
  }

  function resetDraft(row: PreviewErrorRow) {
    rowDrafts[rowKeyOf(row)] = { ...row.values }
  }

  async function saveRow(row: PreviewErrorRow) {
    const key = rowKeyOf(row)
    patchSaving.value = key
    try {
      const resp = await tenantPackagePatchRow(uploadToken.value, {
        sheetName: row.sheetName,
        rowNo: row.rowNo,
        values: draftFor(row),
      })
      // 用重校验后的新预览覆盖,errorRows 随之重算;修好的行会消失
      previewRaw.value = resp as unknown as Record<string, unknown>
      delete rowDrafts[key]
      ElMessage.success(t('tenantPackageImportWizard.rowSavedToast'))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string } | null
      ElMessage.error(
        e?.response?.data?.message ||
          e?.message ||
          t('tenantPackageImportWizard.rowSaveFailedToast'),
      )
    } finally {
      patchSaving.value = null
    }
  }

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
    if (!/\.(xlsx?|xls)$/i.test(f.name)) {
      ElMessage.warning(t('tenantPackageImportWizard.unsupportedFileType', { name: f.name }))
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
    { from: 'resource-queue', to: ['job-definition'] },
    { from: 'business-calendar', to: ['job-definition'] },
    { from: 'batch-window', to: ['job-definition', 'workflow-node'] },
    { from: 'file-template-config', to: ['job-definition', 'pipeline-step-definition'] },
    { from: 'file-channel-config', to: ['pipeline-step-definition'] },
    { from: 'job-definition', to: ['pipeline-definition', 'workflow-node'] },
    { from: 'pipeline-definition', to: ['pipeline-step-definition', 'workflow-node'] },
    { from: 'workflow-definition', to: ['workflow-node', 'workflow-edge'] },
    { from: 'workflow-node', to: ['workflow-edge'] },
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
    for (const r of errorRows.value) {
      s.add(normalizeSheetName(r.sheetName))
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

  const hasInvalidSheets = computed<boolean>(() =>
    sheetStats.value.some((sheet) => sheet.invalid > 0),
  )

  const displaySheetStats = computed<SheetStats[]>(() => {
    if (!showOnlyInvalidSheets.value) return sheetStats.value
    return sheetStats.value.filter((sheet) => sheet.invalid > 0)
  })

  const nextDisabled = computed<boolean>(
    () =>
      step.value >= 2 ||
      (step.value === 0 && !uploadToken.value) ||
      (step.value === 1 && (!previewStats.value || hasBlockingIssues.value)),
  )

  /**
   * I8: issue 表高度自适应:每行 ~36px,base 帧 64;少于 8 条紧凑,多于 8 条限到 480 给出滚动条。
   * 比固定 320 体验更好:少 issue 不空旷,多 issue 滚动条也更长好操作。
   */
  const issueTableMaxHeight = computed<number>(() => {
    const n = errorRows.value.length
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
  const applyResult = shallowRef<TenantPackageApplyResponse | null>(null)

  /** 把后端 apply 返回的 9 实体 insert/update 拆分,展平成表行 */
  const applyBreakdownRows = computed<Array<{ entity: string; inserted: number; updated: number }>>(
    () => {
      const r = applyResult.value
      if (!r) return []
      const ents: Array<[string, string, string]> = [
        ['resource-queue', 'resourceQueueInserted', 'resourceQueueUpdated'],
        ['business-calendar', 'businessCalendarInserted', 'businessCalendarUpdated'],
        ['batch-window', 'batchWindowInserted', 'batchWindowUpdated'],
        ['job-definition', 'jobInserted', 'jobUpdated'],
        ['file-channel-config', 'channelInserted', 'channelUpdated'],
        ['file-template-config', 'fileTemplateInserted', 'fileTemplateUpdated'],
        ['pipeline-definition (+ steps)', 'pipelineInserted', 'pipelineUpdated'],
        ['workflow-definition (+ nodes/edges)', 'workflowInserted', 'workflowUpdated'],
      ]
      return ents
        .map(([entity, ik, uk]) => ({
          entity,
          inserted: Number(r[ik as keyof TenantPackageApplyResponse] ?? 0),
          updated: Number(r[uk as keyof TenantPackageApplyResponse] ?? 0),
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

  async function doDownloadSampleTemplate() {
    sampleTplLoading.value = true
    try {
      const scenarios = selectedSampleScenarios.value.length
        ? selectedSampleScenarios.value
        : ['ALL']
      const blob = await tenantPackageDownloadSampleTemplate(scenarios)
      const scenarioName = scenarios.join('-').toLowerCase()
      triggerBlobDownload(blob, `tenant-package-sample-${scenarioName}.xlsx`)
      ElMessage.success(t('tenantPackageImportWizard.sampleTemplateDownloadedToast'))
    } finally {
      sampleTplLoading.value = false
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
        return
      }
      step.value = 1
      await doPreview()
    } finally {
      upLoading.value = false
    }
  }

  async function doPreview() {
    if (!uploadToken.value) return
    pvLoading.value = true
    try {
      previewRaw.value = (await tenantPackagePreview(uploadToken.value)) as Record<string, unknown>
      showOnlyInvalidSheets.value = hasInvalidSheets.value
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
      await confirmDanger({
        verb: t('tenantPackageImportWizard.applyConfirmTitle'),
        target: '',
        consequence: detail,
        irreversible: true,
        confirmButtonText: t('tenantPackageImportWizard.applyConfirmYes'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return /* user cancelled confirm */
    }
    applyLoading.value = true
    applyError.value = null
    try {
      const res = await tenantPackageApply(uploadToken.value, {})
      // 后端 apply 返每实体 insert/update 拆分,放进 applyResult 让 I10 面板展示完整 breakdown
      applyResult.value = res
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
  .tenant-pkg-page {
    gap: 8px;
    min-width: 0;
    overflow-x: hidden;
  }

  /* 大屏适配:仅本页作用域(.tenant-pkg-page),让 SectionCard 撑满可用高度,
     使内部向导能填满纵向空间,而非矮卡片顶在最上、下方大片空白。其它页不受影响。 */
  .tenant-pkg-page :deep(.section-card) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .tenant-pkg-page :deep(.section-card > .el-card__body) {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
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
    min-width: 0;
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
    min-width: 0;
  }

  .excel-wizard__panel {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
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
    min-width: 0;
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
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
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
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(230px, 300px);
    align-items: stretch;
    gap: var(--space-md);
    margin: var(--card-inner-padding) auto 0;
    padding-top: var(--space-xs);
    max-width: min(920px, 100%);
    width: 100%;
    min-width: 0;
  }

  .upload-zone__toolbar-left {
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    gap: 8px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 72%, var(--color-border) 28%);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 82%, var(--color-bg-canvas) 18%);
    color: var(--color-text-tertiary);
    min-width: 0;
    min-height: 216px;
  }

  .upload-zone__toolbar-left :deep(.el-button.is-link) {
    border-radius: var(--radius-input);
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

  .upload-zone__toolbar-left :deep(.el-button) {
    justify-content: flex-start;
    width: 100%;
    min-height: 34px;
    margin-left: 0;
  }

  .sample-template-control {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    width: 100%;
    min-width: 0;
    padding: 2px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-bg-card) 88%, var(--color-bg-page) 12%);
  }

  .sample-template-control :deep(.el-select) {
    width: 100%;
  }

  .sample-template-control :deep(.el-select__wrapper) {
    min-height: 30px;
    border-radius: calc(var(--radius-input) - 2px);
    box-shadow: none;
    background: var(--color-bg-card);
  }

  .sample-template-control :deep(.el-button.sample-template-control__button) {
    justify-content: center;
    width: 100%;
    min-height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: calc(var(--radius-input) - 2px);
    background: transparent;
    box-shadow: none;
    font-weight: 600;
  }

  .sample-template-control :deep(.el-button.sample-template-control__button:hover) {
    transform: none;
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-color: transparent;
    box-shadow: none;
  }

  .sample-template-control :deep(.el-button.sample-template-control__button span) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    display: none;
  }

  .upload-zone__toolbar-right {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    align-items: stretch;
    gap: 10px;
    justify-content: stretch;
    min-width: 0;
    min-height: 216px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 72%, var(--color-border) 28%);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 82%, var(--color-bg-canvas) 18%);
  }

  /* drag 模式 dropzone */
  .upload-zone__dropzone :deep(.el-upload-dragger) {
    min-height: 128px;
    height: 100%;
    padding: 18px 28px;
    min-width: 0;
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
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
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
    width: 100%;
    min-width: 0;
  }

  .upload-zone__ghost-btn,
  .upload-zone__primary-btn {
    min-height: 44px;
    border-radius: var(--radius-input);
    font-weight: 650;
    padding: 0 18px;
    width: 100%;
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

  :global(.tenant-pkg-guide-drawer .el-drawer__body) {
    padding-top: 8px;
  }

  .guide-drawer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .guide-drawer__filters {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(220px, 300px) auto;
    gap: 10px;
    align-items: center;
  }

  .guide-drawer__summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .guide-drawer__table {
    width: 100%;
  }

  .guide-column-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .guide-column-name code {
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    color: var(--color-text-primary);
    word-break: break-all;
  }

  .guide-row-detail {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
    gap: 16px;
    padding: 8px 14px 12px;
    color: var(--color-text-secondary);
  }

  .guide-row-detail strong {
    display: block;
    margin-bottom: 6px;
    color: var(--color-text-primary);
  }

  .guide-row-detail pre {
    margin: 0;
    padding: 10px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: var(--radius-input);
    border: 1px solid var(--color-border-light);
    background: var(--el-fill-color-lighter);
    color: var(--color-text-primary);
  }

  @media (max-width: 960px) {
    .upload-zone__toolbar {
      grid-template-columns: 1fr;
      max-width: 620px;
      gap: var(--space-sm);
    }

    .upload-zone__toolbar-right {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .guide-drawer__filters {
      grid-template-columns: 1fr;
    }

    .guide-row-detail {
      grid-template-columns: 1fr;
    }
  }

  .upload-zone__file {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 0;
    padding: 6px 10px;
    max-width: 100%;
    border-radius: var(--radius-input);
    background: var(--el-fill-color-light);
    color: var(--color-text-secondary);
    font-size: 13px;
    text-align: left;
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

  .sheet-stats-caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
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
