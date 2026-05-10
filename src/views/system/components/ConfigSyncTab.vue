<template>
  <div class="sync-grid">
    <!-- 跨环境同步参数 sourceEnv / targetEnv 对 3 个动作共享;
         BE ConfigSync*Request 全 NotBlank,默认 'default' 让基础场景跑通,
         真要跨 dev/prod 同步在这里改即可。 -->
    <div class="sync-block sync-block--params">
      <div class="sync-block__title">同步参数</div>
      <div class="sync-block__desc">
        当前租户 <code>{{ tenant.tenantId }}</code> 即源租户;BE 要求 sourceEnv / targetEnv
        都不能为空,默认 default。
      </div>
      <el-form label-width="100px" inline class="form-section">
        <el-form-item label="源环境">
          <el-input v-model="sourceEnv" class="env-input" placeholder="如 default / prod" />
        </el-form-item>
        <el-form-item label="目标环境">
          <el-input v-model="targetEnv" class="env-input" placeholder="如 default / staging" />
        </el-form-item>
        <el-form-item label="目标租户">
          <el-input
            v-model="targetTenantsText"
            class="env-input env-input--wide"
            placeholder="逗号分隔多个;留空则用当前租户"
          />
        </el-form-item>
      </el-form>
    </div>

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
                class="export-row__action"
                v-track-click="'配置同步-导出'"
                @click="doExport"
              >
                下载
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <div v-if="exportResult" class="sync-result">
        <div class="sync-result__title">导出结果</div>
        <JsonPreview :data="exportResult" />
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
            <el-button
              :loading="previewing"
              :disabled="!importPayload.trim()"
              v-track-click="'配置同步-预览'"
              @click="doPreview"
            >
              预览变更
            </el-button>
            <el-button
              type="primary"
              :loading="importing"
              :disabled="!importPayload.trim()"
              v-track-click="'配置同步-导入'"
              @click="doImport"
              >确认导入</el-button
            >
          </el-form-item>
        </el-form>
      </div>
      <div v-if="previewResult" class="sync-result">
        <div class="sync-result__title">预览结果</div>
        <JsonPreview :data="previewResult" />
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
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useTenantReload } from '@/composables/useTenantReload'

  const tenant = useTenantStore()

  // 跨环境同步参数:三个动作共享。BE 全 NotBlank,默认 'default' 兼容单环境场景。
  const sourceEnv = ref('default')
  const targetEnv = ref('default')
  const targetTenantsText = ref('')

  function resolvedTargetTenants(): string[] {
    const list = targetTenantsText.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return list.length ? list : [tenant.tenantId]
  }

  const exporting = ref(false)
  const exportTypes = ref<string[]>([])
  const exportResult = ref<unknown>(null)
  // BE TenantConfigCopyRequest.ConfigType 短别名(JOB / WORKFLOW / ...);老 yaml 用全名(JOB_DEFINITION 等)
  // 与 BE 对不上,改用短别名跟 BE 实际接受值对齐。
  const exportTypeOptions = [
    'JOB',
    'WORKFLOW',
    'PIPELINE',
    'FILE_CHANNEL',
    'FILE_TEMPLATE',
    'RESOURCE_QUEUE',
    'BATCH_WINDOW',
    'BUSINESS_CALENDAR',
    'QUOTA_POLICY',
    'ALERT_ROUTING',
  ] as const

  const previewing = ref(false)
  const importing = ref(false)
  const importPayload = ref('')
  const previewResult = ref<unknown>(null)

  async function doExport() {
    exporting.value = true
    try {
      const types = exportTypes.value.map((s) => s.trim()).filter(Boolean)
      exportResult.value = await exportConfigSync({
        sourceTenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
        ...(types.length ? { configTypes: types } : {}),
      })
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
      // payload 当前没用到(preview 是按 source/target 算 diff,bundle 在 import 才用)
      JSON.parse(importPayload.value) // 仅校验合法 JSON
      previewResult.value = await previewConfigSync({
        sourceTenantId: tenant.tenantId,
        tenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
      })
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
      const bundle = JSON.parse(importPayload.value)
      await importConfigSync({
        tenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
        targetTenantIds: resolvedTargetTenants(),
        bundle,
      })
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

  .sync-block--params {
    grid-column: 1 / -1;
  }
  .env-input {
    width: 200px;
  }
  .env-input--wide {
    width: 320px;
  }

  .sync-block {
    padding: var(--card-inner-padding);
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background:
      radial-gradient(1200px 420px at 0% 0%, rgb(59 130 246 / 8%), transparent 55%),
      color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 55%),
      0 1px 2px rgb(15 23 42 / 6%);
  }

  .sync-block__title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: var(--color-text);
    margin: 0 0 6px;
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
    gap: 10px;
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
    flex: 0 0 auto;
    box-shadow:
      0 10px 22px rgb(59 130 246 / 12%),
      inset 0 1px 0 rgb(255 255 255 / 20%);
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

  .form-actions :deep(.el-form-item__content) {
    justify-content: flex-end;
    gap: 10px;
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
