<template>
  <div class="sync-grid">
    <div class="sync-block">
      <div class="sync-block__title">配置导出</div>
      <div class="sync-block__desc">
        选择要导出的配置域（留空表示全部），点击下载按钮获取 JSON。
      </div>
      <div class="form-panel">
        <el-form label-width="100px" class="form-section">
          <el-form-item label="配置类型" class="export-item">
            <div class="export-row">
              <el-select
                v-model="exportTypes"
                multiple
                filterable
                clearable
                allow-create
                default-first-option
                collapse-tags
                collapse-tags-tooltip
                placeholder="留空导出全部；可多选/输入，如 JOB, WORKFLOW"
                class="export-row__select"
              >
                <el-option v-for="t in exportTypeOptions" :key="t" :label="t" :value="t" />
              </el-select>
              <el-button
                type="primary"
                :loading="exporting"
                :icon="Download"
                circle
                class="export-row__action"
                v-track-click="'配置同步-导出'"
                @click="doExport"
              />
            </div>
          </el-form-item>
        </el-form>
      </div>
      <div v-if="exportResult" class="sync-result">
        <div class="sync-result__title">导出结果</div>
        <pre class="json-preview">{{ JSON.stringify(exportResult, null, 2) }}</pre>
      </div>
    </div>

    <div class="sync-block">
      <div class="sync-block__title">配置导入</div>
      <div class="sync-block__desc">粘贴导出的 JSON。建议先“预览变更”确认差异，再执行导入。</div>
      <div class="form-panel">
        <el-form label-width="100px">
          <el-form-item label="Payload">
            <el-input
              v-model="importPayload"
              type="textarea"
              :rows="8"
              placeholder="粘贴导出的 JSON"
              class="sync-payload"
            />
          </el-form-item>
          <el-form-item class="form-actions">
            <el-button :loading="previewing" v-track-click="'配置同步-预览'" @click="doPreview"
              >预览变更</el-button
            >
            <el-button
              type="primary"
              :loading="importing"
              v-track-click="'配置同步-导入'"
              @click="doImport"
              >确认导入</el-button
            >
          </el-form-item>
        </el-form>
      </div>
      <div v-if="previewResult" class="sync-result">
        <div class="sync-result__title">预览结果</div>
        <pre class="json-preview">{{ JSON.stringify(previewResult, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Download } from '@element-plus/icons-vue'
  import { exportConfigSync, previewConfigSync, importConfigSync } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'

  const tenant = useTenantStore()

  const exporting = ref(false)
  const exportTypes = ref<string[]>([])
  const exportResult = ref<unknown>(null)
  const exportTypeOptions = ['JOB', 'WORKFLOW', 'PIPELINE', 'FILE', 'ALERT', 'SYSTEM'] as const

  const previewing = ref(false)
  const importing = ref(false)
  const importPayload = ref('')
  const previewResult = ref<unknown>(null)

  async function doExport() {
    exporting.value = true
    try {
      const body: { tenantId: string; configTypes?: string[] } = { tenantId: tenant.tenantId }
      const types = exportTypes.value.map((s) => s.trim()).filter(Boolean)
      if (types.length) body.configTypes = types
      exportResult.value = await exportConfigSync(body)
      ElMessage.success('导出完成')
    } finally {
      exporting.value = false
    }
  }

  async function doPreview() {
    if (!importPayload.value.trim()) {
      ElMessage.warning('请输入 Payload')
      return
    }
    previewing.value = true
    try {
      const payload = JSON.parse(importPayload.value)
      previewResult.value = await previewConfigSync({ tenantId: tenant.tenantId, payload })
    } catch (e) {
      ElMessage.error(e instanceof SyntaxError ? 'Payload 需为合法 JSON' : '预览失败')
    } finally {
      previewing.value = false
    }
  }

  async function doImport() {
    if (!importPayload.value.trim()) {
      ElMessage.warning('请输入 Payload')
      return
    }
    importing.value = true
    try {
      const payload = JSON.parse(importPayload.value)
      await importConfigSync({ tenantId: tenant.tenantId, payload })
      ElMessage.success('导入完成')
    } catch (e) {
      ElMessage.error(e instanceof SyntaxError ? 'Payload 需为合法 JSON' : '导入失败')
    } finally {
      importing.value = false
    }
  }

  useTenantReload(() => {
    exportResult.value = null
    previewResult.value = null
  })
</script>

<style scoped>
  .sync-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
    align-items: start;
  }

  @media (min-width: 1100px) {
    .sync-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-lg);
    }
  }

  .sync-block {
    padding: var(--card-inner-padding);
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 55%),
      0 1px 2px rgb(15 23 42 / 6%);
  }

  .sync-block__title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-secondary);
    margin: 2px 0 6px;
  }

  .sync-block__desc {
    margin: 0 0 var(--space-md);
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-tertiary, #909399);
  }

  .export-row {
    display: flex;
    align-items: center;
    width: 100%;
    position: relative;
  }

  .export-row__select {
    flex: 1;
    min-width: 0;
    width: 100%;
  }

  .export-item :deep(.el-form-item__content) {
    width: 100%;
  }

  .export-row__action {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    box-shadow:
      0 10px 22px rgb(59 130 246 / 12%),
      inset 0 1px 0 rgb(255 255 255 / 20%);
  }

  .export-row :deep(.el-input__wrapper) {
    padding-right: 54px;
  }

  .export-row__action:hover {
    filter: saturate(1.02);
  }

  @media (max-width: 640px) {
    .export-row {
      flex-direction: column;
      align-items: stretch;
    }

    .export-row__select {
      min-width: 0;
      width: 100%;
    }
  }

  .sync-payload :deep(.el-textarea__inner) {
    font-family: var(
      --font-family-mono,
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      monospace
    );
    font-size: 12px;
    line-height: 1.55;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-bg-canvas) 88%, #fff 12%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 55%);
    min-height: 220px;
  }

  .sync-result {
    margin-top: var(--space-md);
    padding-top: var(--space-sm);
    border-top: 1px dashed color-mix(in srgb, var(--color-border) 60%, transparent);
  }

  .sync-result__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
  }
</style>
