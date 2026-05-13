<template>
  <div class="sync">
    <!-- 顶部业务说明 -->
    <p class="sync__hint">{{ t('configSyncTab.hint') }}</p>

    <div class="sync__flow">
      <!-- ─── 源(当前租户) ─────────────────────────────── -->
      <section class="sync__pane sync__pane--source" :aria-label="t('configSyncTab.sourceTitle')">
        <header class="sync__pane-head">
          <span class="sync__badge sync__badge--source">{{ t('configSyncTab.sourceTitle') }}</span>
          <code class="sync__tenant">{{ tenant.tenantId }}</code>
        </header>

        <el-form label-width="68px" class="sync__form">
          <el-form-item :label="t('configSyncTab.sourceEnvLabel')">
            <el-input v-model="sourceEnv" :placeholder="t('configSyncTab.sourceEnvPlaceholder')" />
          </el-form-item>

          <el-form-item :label="t('configSyncTab.typesTitle')">
            <div class="sync__types">
              <el-checkbox v-for="opt in exportTypeOptions" :key="opt.value" v-model="opt.checked">
                {{ opt.label }}
              </el-checkbox>
            </div>
            <p class="sync__types-hint">{{ t('configSyncTab.typesDescAll') }}</p>
          </el-form-item>
        </el-form>

        <div class="sync__actions sync__actions--source">
          <el-button
            type="primary"
            :loading="exporting"
            :icon="Download"
            v-track-click="t('configSyncTab.trackExport')"
            @click="doExport"
          >
            {{ t('configSyncTab.btnExport') }}
          </el-button>
          <el-button v-if="exportResult" :icon="Right" plain @click="copyToTarget">
            {{ t('configSyncTab.btnCopyToTarget') }}
          </el-button>
        </div>
      </section>

      <!-- 流向箭头(>=1100px 显示) -->
      <div class="sync__arrow" aria-hidden="true">
        <el-icon><Right /></el-icon>
      </div>

      <!-- ─── 目标 ─────────────────────────────────────── -->
      <section class="sync__pane sync__pane--target" :aria-label="t('configSyncTab.targetTitle')">
        <header class="sync__pane-head">
          <span class="sync__badge sync__badge--target">{{ t('configSyncTab.targetTitle') }}</span>
        </header>

        <el-form label-width="68px" class="sync__form">
          <el-form-item :label="t('configSyncTab.targetEnvLabel')">
            <el-input v-model="targetEnv" :placeholder="t('configSyncTab.targetEnvPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('configSyncTab.targetTenantsLabel')">
            <el-input
              v-model="targetTenantsText"
              :placeholder="t('configSyncTab.targetTenantsPlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('configSyncTab.payloadLabel')">
            <el-input
              v-model="importPayload"
              type="textarea"
              :rows="8"
              :placeholder="t('configSyncTab.payloadPlaceholder')"
              class="sync__payload"
            />
          </el-form-item>
        </el-form>

        <div class="sync__actions sync__actions--target">
          <el-button
            :loading="previewing"
            :disabled="!importPayload.trim()"
            :icon="View"
            v-track-click="t('configSyncTab.trackPreview')"
            @click="doPreview"
          >
            {{ t('configSyncTab.btnPreview') }}
          </el-button>
          <el-button
            type="danger"
            :loading="importing"
            :disabled="!importPayload.trim()"
            :icon="Upload"
            v-track-click="t('configSyncTab.trackImport')"
            @click="doImport"
          >
            {{ t('configSyncTab.btnImport') }}
          </el-button>
        </div>
      </section>
    </div>

    <!-- ─── 结果区(全宽,导出/差异共享) ─────────────────── -->
    <section v-if="displayResult" class="sync__result">
      <header class="sync__result-head">
        <span class="sync__result-title">{{ displayResultTitle }}</span>
      </header>
      <JsonPreview :data="displayResult" />
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Download, Right, View, Upload } from '@element-plus/icons-vue'
  import { exportConfigSync, previewConfigSync, importConfigSync } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  // BE NotBlank,默认 'default' 兼容单环境场景
  const sourceEnv = ref('default')
  const targetEnv = ref('default')
  const targetTenantsText = ref('')

  // BE TenantConfigCopyRequest.ConfigType 短别名
  const exportTypeOptions = ref([
    { value: 'JOB', label: t('configSyncTab.typeJob'), checked: false },
    { value: 'WORKFLOW', label: t('configSyncTab.typeWorkflow'), checked: false },
    { value: 'PIPELINE', label: t('configSyncTab.typePipeline'), checked: false },
    { value: 'FILE_CHANNEL', label: t('configSyncTab.typeFileChannel'), checked: false },
    { value: 'FILE_TEMPLATE', label: t('configSyncTab.typeFileTemplate'), checked: false },
    { value: 'RESOURCE_QUEUE', label: t('configSyncTab.typeResourceQueue'), checked: false },
    { value: 'BATCH_WINDOW', label: t('configSyncTab.typeBatchWindow'), checked: false },
    {
      value: 'BUSINESS_CALENDAR',
      label: t('configSyncTab.typeBusinessCalendar'),
      checked: false,
    },
    { value: 'QUOTA_POLICY', label: t('configSyncTab.typeQuotaPolicy'), checked: false },
    { value: 'ALERT_ROUTING', label: t('configSyncTab.typeAlertRouting'), checked: false },
  ])

  const exporting = ref(false)
  const previewing = ref(false)
  const importing = ref(false)
  const exportResult = ref<unknown>(null)
  const previewResult = ref<unknown>(null)
  const importPayload = ref('')

  // 差异预览结果优先于导出结果(用户最近的动作)
  const displayResult = computed(() => previewResult.value ?? exportResult.value)
  const displayResultTitle = computed(() =>
    previewResult.value ? t('configSyncTab.resultPreview') : t('configSyncTab.resultExport'),
  )

  function resolvedTargetTenants(): string[] {
    const list = targetTenantsText.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return list.length ? list : [tenant.tenantId]
  }

  async function doExport() {
    exporting.value = true
    try {
      const types = exportTypeOptions.value.filter((o) => o.checked).map((o) => o.value)
      exportResult.value = await exportConfigSync({
        sourceTenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
        ...(types.length ? { configTypes: types } : {}),
      })
      previewResult.value = null
      ElMessage.success(t('configSyncTab.toastExportDone'))
    } finally {
      exporting.value = false
    }
  }

  function copyToTarget() {
    if (!exportResult.value) return
    importPayload.value = JSON.stringify(exportResult.value, null, 2)
    ElMessage.success(t('configSyncTab.toastCopiedToTarget'))
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
    let bundle: unknown
    try {
      bundle = JSON.parse(importPayload.value)
    } catch {
      ElMessage.error(t('configSyncTab.errInvalidJson'))
      return
    }
    const tenants = resolvedTargetTenants()
    try {
      await confirmDanger({
        verb: '应用配置',
        target: `到 ${tenants.length} 个目标租户(${tenants.slice(0, 3).join(', ')}${tenants.length > 3 ? '…' : ''})`,
        consequence: t('configSyncTab.importConsequence'),
        irreversible: true,
        confirmButtonText: '确认应用',
      })
    } catch {
      return
    }
    importing.value = true
    try {
      await importConfigSync({
        tenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
        targetTenantIds: tenants,
        bundle,
      })
      ElMessage.success(t('configSyncTab.toastImportDone'))
    } catch {
      ElMessage.error(t('configSyncTab.errImportFailed'))
    } finally {
      importing.value = false
    }
  }

  useTenantReload(() => {
    exportResult.value = null
    previewResult.value = null
    importPayload.value = ''
    exportTypeOptions.value.forEach((o) => (o.checked = false))
  })
</script>

<style scoped>
  .sync {
    display: grid;
    gap: var(--space-md);
  }

  .sync__hint {
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card) 94%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border-light) 84%);
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  .sync__flow {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
    align-items: stretch;
  }

  @media (min-width: 1100px) {
    .sync__flow {
      grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr);
      gap: var(--space-md);
    }
  }

  .sync__pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--card-inner-padding);
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%);
  }

  .sync__pane--source {
    border-color: color-mix(in srgb, var(--color-success) 22%, var(--color-border-light) 78%);
  }

  .sync__pane--target {
    border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border-light) 78%);
  }

  .sync__pane-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .sync__badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.6;
  }

  .sync__badge--source {
    background: color-mix(in srgb, var(--color-success) 14%, var(--color-bg-card) 86%);
    color: var(--color-success);
  }

  .sync__badge--target {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card) 86%);
    color: var(--color-primary);
  }

  .sync__tenant {
    font-family: var(--font-family-mono, ui-monospace, Menlo, Monaco, Consolas, monospace);
    font-size: 12px;
    color: var(--color-text-secondary);
    padding: 2px 8px;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-bg-canvas) 92%, transparent 8%);
  }

  .sync__form {
    --el-form-label-color: var(--color-text-secondary);
  }

  .sync__types {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 4px 8px;
    width: 100%;
  }

  .sync__types-hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .sync__payload :deep(.el-textarea__inner) {
    font-family: var(--font-family-mono, ui-monospace, Menlo, Monaco, Consolas, monospace);
    font-size: 12px;
    line-height: 1.55;
    min-height: 200px;
  }

  .sync__actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
  }

  .sync__actions--target {
    justify-content: flex-end;
  }

  .sync__arrow {
    display: none;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
    font-size: 22px;
  }

  @media (min-width: 1100px) {
    .sync__arrow {
      display: flex;
    }
  }

  .sync__result {
    padding: var(--card-inner-padding);
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%);
  }

  .sync__result-head {
    margin-bottom: 8px;
  }

  .sync__result-title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text);
  }
</style>
