<template>
  <PageContainer class="excel-wizard-page">
    <PageHeader
      :title="title"
      description="单域 Excel 配置维护:上传 → 预览校验 → 应用变更。"
      compact
    >
      <template #actions>
        <el-tag v-if="domainValid" size="small" type="primary" effect="plain" round>
          {{ domainLabels[activeDomain] }}
        </el-tag>
      </template>
    </PageHeader>
    <SectionCard>
      <div v-if="!domainValid" class="wizard-alert mt">
        <el-alert
          type="error"
          :closable="false"
          title="参数不正确，请从左侧菜单进入对应的 Excel 维护入口。"
        />
      </div>

      <template v-else>
        <el-tabs
          v-model="activeDomain"
          tab-position="top"
          v-hover-tab-activate="true"
          class="pill-tabs"
        >
          <el-tab-pane
            v-for="item in domainOptions"
            :key="item.value"
            :label="item.label"
            :name="item.value"
          >
            <div class="excel-wizard">
              <div class="excel-wizard__steps-shell">
                <el-steps
                  :active="step"
                  finish-status="success"
                  align-center
                  class="excel-wizard__steps"
                >
                  <el-step title="上传" description="选择并提交文件" />
                  <el-step title="预览" description="校验与汇总" />
                  <el-step title="应用" description="写入配置" />
                </el-steps>
              </div>

              <div class="excel-wizard__body">
                <div
                  v-show="step === 0"
                  class="excel-wizard__panel"
                  v-loading="upLoading"
                  element-loading-text="正在上传文件..."
                >
                  <div class="upload-zone">
                    <el-icon class="upload-zone__icon" :size="36">
                      <Upload />
                    </el-icon>
                    <p class="upload-zone__title">上传 Excel</p>
                    <p class="upload-zone__desc">
                      支持 .xlsx / .xls（单文件）。上传成功后可进入预览校验。
                    </p>
                    <div class="upload-zone__toolbar">
                      <div class="upload-zone__toolbar-left">
                        <el-button
                          link
                          type="primary"
                          :loading="tplLoading"
                          @click="doDownloadTemplate"
                        >
                          下载导入模板
                        </el-button>
                        <span class="upload-zone__toolbar-dot" aria-hidden="true">•</span>
                        <el-button link type="primary" :loading="exportLoading" @click="doExport">
                          导出当前配置
                        </el-button>
                      </div>
                      <div class="upload-zone__toolbar-right">
                        <el-upload
                          :auto-upload="false"
                          :limit="1"
                          :on-change="onFile"
                          :show-file-list="false"
                        >
                          <el-button
                            class="upload-zone__ghost-btn"
                            type="primary"
                            plain
                            size="large"
                          >
                            选择文件
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
                          开始上传
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
                    <template #title>上传成功</template>
                    <div class="excel-wizard__token-label">uploadToken</div>
                    <pre class="excel-wizard__token-code">{{ uploadToken }}</pre>
                  </el-alert>
                </div>

                <div
                  v-show="step === 1"
                  class="excel-wizard__panel excel-wizard__panel--wide"
                  v-loading="pvLoading"
                  element-loading-text="正在拉取预览数据..."
                >
                  <p v-if="!uploadToken" class="excel-wizard__mute-hint">
                    请先在「上传」步骤完成文件提交。
                  </p>
                  <template v-else>
                    <div class="excel-wizard__panel-head">
                      <h3 class="excel-wizard__panel-title">预览与校验</h3>
                      <div class="excel-wizard__panel-actions">
                        <el-button
                          type="primary"
                          :disabled="!uploadToken"
                          :loading="pvLoading"
                          @click="doPreview"
                        >
                          拉取预览
                        </el-button>
                        <el-tooltip
                          v-if="workbookSupported"
                          content="下载服务端生成的带逐格错误注释的 Excel，可在本地修正后重新上传"
                          placement="top"
                        >
                          <el-button
                            :disabled="!uploadToken"
                            :loading="wbLoading"
                            @click="doDownloadPreviewWorkbook"
                          >
                            下载带注释预览
                          </el-button>
                        </el-tooltip>
                      </div>
                    </div>
                    <el-descriptions
                      v-if="previewStats"
                      class="excel-wizard__desc"
                      :column="3"
                      border
                      title="汇总"
                    >
                      <el-descriptions-item label="totalRows">{{
                        previewStats.total
                      }}</el-descriptions-item>
                      <el-descriptions-item label="validRows">{{
                        previewStats.valid
                      }}</el-descriptions-item>
                      <el-descriptions-item label="invalidRows">{{
                        previewStats.invalid
                      }}</el-descriptions-item>
                      <el-descriptions-item label="预计新增">{{
                        previewStats.insert
                      }}</el-descriptions-item>
                      <el-descriptions-item label="预计更新">{{
                        previewStats.update
                      }}</el-descriptions-item>
                    </el-descriptions>
                    <el-alert
                      v-if="previewWorkbookUrl"
                      type="info"
                      :closable="false"
                      show-icon
                      class="excel-wizard__desc"
                    >
                      <template #title>
                        服务端已生成带注释预览：
                        <a :href="previewWorkbookUrl" target="_blank" class="cell-link"
                          >下载 Excel</a
                        >
                      </template>
                    </el-alert>
                    <div v-if="issueRows.length" class="excel-wizard__table-block">
                      <div class="excel-wizard__table-caption">行级问题</div>
                      <el-table
                        class="wizard-stretch console-table"
                        :data="issueRows"
                        max-height="320"
                        stripe
                        border
                        highlight-current-row
                        empty-text="暂无数据"
                      >
                        <el-table-column prop="sheetName" label="Sheet" width="120" />
                        <el-table-column prop="rowNo" label="行" width="70" />
                        <el-table-column prop="messages" label="原因" min-width="200" />
                      </el-table>
                    </div>
                  </template>
                </div>

                <div v-show="step === 2" class="excel-wizard__panel">
                  <div class="apply-zone">
                    <el-icon class="apply-zone__icon" :size="32">
                      <WarningFilled />
                    </el-icon>
                    <h3 class="apply-zone__title">确认应用</h3>
                    <p class="apply-zone__desc">
                      将把当前
                      <code>uploadToken</code>
                      对应的预览结果写入租户配置。执行前请已在「预览」中确认数据无误。
                    </p>
                    <el-descriptions
                      v-if="previewStats"
                      class="apply-zone__diff"
                      :column="2"
                      border
                    >
                      <el-descriptions-item label="预计新增">{{
                        previewStats.insert
                      }}</el-descriptions-item>
                      <el-descriptions-item label="预计更新">{{
                        previewStats.update
                      }}</el-descriptions-item>
                      <el-descriptions-item label="有效行">{{
                        previewStats.valid
                      }}</el-descriptions-item>
                      <el-descriptions-item label="无效行">{{
                        previewStats.invalid
                      }}</el-descriptions-item>
                    </el-descriptions>
                    <el-button type="danger" size="large" :disabled="!uploadToken" @click="doApply">
                      确认应用变更
                    </el-button>
                  </div>
                </div>
              </div>

              <div class="excel-wizard__footer">
                <el-tooltip content="上一步" placement="top">
                  <button
                    class="wizard-nav wizard-nav--prev"
                    :disabled="step <= 0"
                    aria-label="上一步"
                    @click="step--"
                  >
                    <el-icon><ArrowLeft /></el-icon>
                  </button>
                </el-tooltip>
                <span class="wizard-nav__progress">{{ step + 1 }} / 3</span>
                <el-tooltip content="下一步" placement="top">
                  <button
                    class="wizard-nav wizard-nav--next"
                    :disabled="step >= 2 || (step === 0 && !uploadToken)"
                    aria-label="下一步"
                    @click="step++"
                  >
                    <el-icon><ArrowRight /></el-icon>
                  </button>
                </el-tooltip>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, ArrowRight, Document, Upload, WarningFilled } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    excelApply,
    excelDownloadPreviewWorkbook,
    excelDownloadTemplate,
    excelExport,
    excelPreview,
    excelUpload,
    supportsPreviewWorkbook,
    STANDALONE_DOMAINS,
    type ExcelDomain,
  } from '@/api/excelDomains'
  import { useImportWizard } from '@/composables/useImportWizard'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const route = useRoute()
  const router = useRouter()
  // 仅挂载 5 个「初始化就维护」域；合并导入的 5 个域代码保留但不在此页面展示
  const allowed: ExcelDomain[] = [...STANDALONE_DOMAINS]
  const domainLabels: Record<ExcelDomain, string> = {
    'file-templates': '文件模板',
    'file-channels': '文件渠道', // 合并导入域（代码保留）
    workflows: '工作流', // 合并导入域（代码保留）
    'job-definitions': '作业定义', // 合并导入域（代码保留）
    'alert-routings': '告警路由', // 合并导入域（代码保留）
    'batch-windows': '批次窗口',
    'business-calendars': '业务日历',
    'pipeline-definitions': '流水线定义', // 合并导入域（代码保留）
    'quota-policies': '配额策略',
    'resource-queues': '资源队列',
  }
  const domainOptions = allowed.map((value) => ({
    label: domainLabels[value],
    value,
  }))
  const domainFromRoute = computed(() => {
    const queryDomain = route.query.domain
    if (typeof queryDomain === 'string') return queryDomain
    const paramDomain = route.params.domain
    if (typeof paramDomain === 'string') return paramDomain
    return allowed[0]
  })
  const domainValid = computed(() => allowed.includes(domainFromRoute.value as ExcelDomain))
  const activeDomain = computed<ExcelDomain>({
    get() {
      return domainValid.value ? (domainFromRoute.value as ExcelDomain) : allowed[0]
    },
    set(value) {
      void router.replace({
        path: '/config/excel',
        query: {
          ...route.query,
          domain: value,
        },
      })
    },
  })
  const title = computed(() =>
    domainValid.value ? `Excel 维护 — ${domainLabels[activeDomain.value]}` : 'Excel 维护',
  )

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

  const workbookSupported = computed(() => supportsPreviewWorkbook(activeDomain.value))

  async function doDownloadTemplate() {
    if (!domainValid.value) return
    tplLoading.value = true
    try {
      const blob = await excelDownloadTemplate(activeDomain.value)
      triggerBlobDownload(blob, `${activeDomain.value}-template.xlsx`)
      ElMessage.success('模板已下载')
    } finally {
      tplLoading.value = false
    }
  }

  async function doExport() {
    if (!domainValid.value) return
    exportLoading.value = true
    try {
      const blob = await excelExport(activeDomain.value)
      triggerBlobDownload(blob, `${activeDomain.value}-export.xlsx`)
      ElMessage.success('配置已导出')
    } finally {
      exportLoading.value = false
    }
  }

  async function doUpload() {
    if (!file.value || !domainValid.value) return
    upLoading.value = true
    try {
      const res = await excelUpload(activeDomain.value, file.value)
      uploadToken.value = res.uploadToken ?? ''
      if (!uploadToken.value) {
        ElMessage.warning('响应中未找到 uploadToken，请核对后端 multipart 字段名与契约。')
      }
    } finally {
      upLoading.value = false
    }
  }

  async function doPreview() {
    if (!uploadToken.value || !domainValid.value) return
    pvLoading.value = true
    try {
      previewRaw.value = (await excelPreview(activeDomain.value, uploadToken.value)) as Record<
        string,
        unknown
      >
    } finally {
      pvLoading.value = false
    }
  }

  async function doDownloadPreviewWorkbook() {
    if (!uploadToken.value || !domainValid.value || !workbookSupported.value) return
    wbLoading.value = true
    try {
      const blob = await excelDownloadPreviewWorkbook(activeDomain.value, uploadToken.value)
      triggerBlobDownload(blob, `${activeDomain.value}-preview-${uploadToken.value}.xlsx`)
      ElMessage.success('已下载带注释预览文件')
    } finally {
      wbLoading.value = false
    }
  }

  async function doApply() {
    if (!uploadToken.value || !domainValid.value) return
    try {
      await ElMessageBox.confirm('确认将预览结果应用到租户配置？', '应用', { type: 'warning' })
      await excelApply(activeDomain.value, uploadToken.value, {})
    } catch {
      /* cancel */
    }
  }

  watch(domainFromRoute, () => {
    step.value = 0
    file.value = null
    uploadToken.value = ''
    previewRaw.value = null
  })
</script>

<style scoped>
  :deep(.excel-wizard-page) {
    gap: 8px;
  }

  .wizard-alert {
    max-width: 640px;
    margin-left: auto;
    margin-right: auto;
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
    padding: var(--space-sm) var(--page-block-gap) var(--page-block-gap);
    margin: 0;
    margin-bottom: var(--page-block-gap);
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
    padding-bottom: var(--card-inner-padding);
    box-sizing: border-box;
  }

  .excel-wizard__panel--wide {
    max-width: 100%;
    align-items: stretch;
  }

  .upload-zone {
    width: 100%;
    padding: var(--space-md) var(--card-inner-padding);
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
    margin: var(--space-sm) 0 var(--space-xs);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.3;
  }

  .upload-zone__desc {
    margin: 0 auto;
    max-width: 420px;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.55;
  }

  .upload-zone__desc code {
    font-size: 12px;
    padding: 1px 6px;
    border-radius: var(--radius-content);
    background: var(--el-fill-color-light);
    color: var(--color-text-primary);
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
    gap: var(--space-xs);
    margin-top: var(--page-block-gap);
    padding: var(--space-xs) var(--page-block-gap);
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
    margin-top: var(--card-inner-padding);
    text-align: left;
  }

  .excel-wizard__token-alert :deep(.el-alert__content) {
    width: 100%;
  }

  .excel-wizard__token-label {
    margin-top: var(--space-xs);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .excel-wizard__token-code {
    margin: var(--space-xs) 0 0;
    padding: var(--space-sm) var(--page-block-gap);
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
    margin: 0 0 var(--page-block-gap);
    font-size: 13px;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .excel-wizard__panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--page-block-gap);
    margin-bottom: var(--page-block-gap);
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
    gap: var(--space-sm);
  }

  .excel-wizard__desc {
    width: 100%;
  }

  .excel-wizard__table-block {
    margin-top: var(--card-inner-padding);
    width: 100%;
  }

  .excel-wizard__table-caption {
    margin-bottom: var(--space-xs);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .wizard-stretch {
    width: 100%;
  }

  .apply-zone {
    width: 100%;
    padding: var(--space-md) var(--card-inner-padding);
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
    margin: 0 auto var(--card-inner-padding);
    max-width: 440px;
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

  .apply-zone__diff {
    width: min(520px, 100%);
    margin: 0 auto var(--space-md);
    text-align: left;
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

  .mt {
    margin-top: var(--space-lg, 16px);
  }
</style>
