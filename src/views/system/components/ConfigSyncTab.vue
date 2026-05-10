<template>
  <div class="sync-grid">
    <!-- 跨环境同步参数 sourceEnv / targetEnv 对 3 个动作共享;
         BE ConfigSync*Request 全 NotBlank,默认 'default' 让基础场景跑通,
         真要跨 dev/prod 同步在这里改即可。 -->
    <div class="sync-block sync-block--params">
      <div class="sync-block__title">{{ t('configSyncTab.paramsTitle') }}</div>
      <div class="sync-block__desc">
        <i18n-t keypath="configSyncTab.paramsDesc" tag="span">
          <template #tenant
            ><code>{{ tenant.tenantId }}</code></template
          >
        </i18n-t>
      </div>
      <el-form label-width="100px" inline class="form-section">
        <el-form-item :label="t('configSyncTab.sourceEnvLabel')">
          <el-input
            v-model="sourceEnv"
            class="env-input"
            :placeholder="t('configSyncTab.sourceEnvPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configSyncTab.targetEnvLabel')">
          <el-input
            v-model="targetEnv"
            class="env-input"
            :placeholder="t('configSyncTab.targetEnvPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configSyncTab.targetTenantsLabel')">
          <el-input
            v-model="targetTenantsText"
            class="env-input env-input--wide"
            :placeholder="t('configSyncTab.targetTenantsPlaceholder')"
          />
        </el-form-item>
      </el-form>
    </div>

    <div class="sync-block">
      <div class="sync-block__title">{{ t('configSyncTab.exportTitle') }}</div>
      <div class="sync-block__desc">{{ t('configSyncTab.exportDesc') }}</div>
      <div class="form-panel">
        <el-form label-width="100px" class="form-section">
          <el-form-item :label="t('configSyncTab.exportTypesLabel')" class="export-item">
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
                :placeholder="t('configSyncTab.exportTypesPlaceholder')"
                class="export-row__select"
              >
                <el-option v-for="opt in exportTypeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
              <el-button
                type="primary"
                :loading="exporting"
                :icon="Download"
                class="export-row__action"
                v-track-click="t('configSyncTab.trackExport')"
                @click="doExport"
              >
                {{ t('configSyncTab.btnDownload') }}
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <div v-if="exportResult" class="sync-result">
        <div class="sync-result__title">{{ t('configSyncTab.exportResultTitle') }}</div>
        <JsonPreview :data="exportResult" />
      </div>
    </div>

    <div class="sync-block">
      <div class="sync-block__title">{{ t('configSyncTab.importTitle') }}</div>
      <div class="sync-block__desc">{{ t('configSyncTab.importDesc') }}</div>
      <div class="form-panel">
        <el-form label-width="100px">
          <el-form-item :label="t('configSyncTab.payloadLabel')">
            <el-input
              v-model="importPayload"
              type="textarea"
              :rows="8"
              :placeholder="t('configSyncTab.payloadPlaceholder')"
              class="sync-payload"
            />
          </el-form-item>
          <el-form-item class="form-actions">
            <el-button
              :loading="previewing"
              :disabled="!importPayload.trim()"
              v-track-click="t('configSyncTab.trackPreview')"
              @click="doPreview"
            >
              {{ t('configSyncTab.btnPreview') }}
            </el-button>
            <el-button
              type="primary"
              :loading="importing"
              :disabled="!importPayload.trim()"
              v-track-click="t('configSyncTab.trackImport')"
              @click="doImport"
            >
              {{ t('configSyncTab.btnImport') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div v-if="previewResult" class="sync-result">
        <div class="sync-result__title">{{ t('configSyncTab.previewResultTitle') }}</div>
        <JsonPreview :data="previewResult" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
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
      ElMessage.success(t('configSyncTab.toastExportDone'))
    } finally {
      exporting.value = false
    }
  }

  async function doPreview() {
    if (!importPayload.value.trim()) {
      ElMessage.warning(t('configSyncTab.toastNeedPayload'))
      return
    }
    previewing.value = true
    try {
      JSON.parse(importPayload.value)
      previewResult.value = await previewConfigSync({
        sourceTenantId: tenant.tenantId,
        tenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
      })
    } catch (e) {
      ElMessage.error(
        e instanceof SyntaxError
          ? t('configSyncTab.errInvalidJson')
          : t('configSyncTab.errPreviewFailed'),
      )
    } finally {
      previewing.value = false
    }
  }

  async function doImport() {
    if (!importPayload.value.trim()) {
      ElMessage.warning(t('configSyncTab.toastNeedPayload'))
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
      ElMessage.success(t('configSyncTab.toastImportDone'))
    } catch (e) {
      ElMessage.error(
        e instanceof SyntaxError
          ? t('configSyncTab.errInvalidJson')
          : t('configSyncTab.errImportFailed'),
      )
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
