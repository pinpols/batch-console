<template>
  <div class="sync">
    <p class="sync__hint">{{ t('configSyncTab.hint') }}</p>

    <div class="sync__flow">
      <!-- ─── 源 ──────────────────────────────────────── -->
      <section class="sync__pane" :aria-label="t('configSyncTab.sourceTitle')">
        <header class="sync__head">
          <span class="sync__step">01</span>
          <div class="sync__head-text">
            <span class="sync__title">{{ t('configSyncTab.sourceTitle') }}</span>
            <span class="sync__subtitle">{{ tenant.tenantId }}</span>
          </div>
        </header>

        <div class="sync__body">
          <el-form label-width="56px" class="sync__form" size="default">
            <el-form-item :label="t('configSyncTab.sourceEnvLabel')">
              <el-input
                v-model="sourceEnv"
                :placeholder="t('configSyncTab.sourceEnvPlaceholder')"
              />
            </el-form-item>

            <el-form-item :label="t('configSyncTab.typesTitle')">
              <div class="sync__types">
                <el-checkbox
                  v-for="opt in exportTypeOptions"
                  :key="opt.value"
                  v-model="opt.checked"
                >
                  {{ opt.label }}
                </el-checkbox>
              </div>
              <p class="sync__types-hint">{{ t('configSyncTab.typesDescAll') }}</p>
            </el-form-item>
          </el-form>
        </div>

        <footer class="sync__footer">
          <el-button v-if="exportResult" :icon="Right" plain size="default" @click="copyToTarget">
            {{ t('configSyncTab.btnCopyToTarget') }}
          </el-button>
          <el-button
            type="primary"
            :loading="exporting"
            :icon="Download"
            v-track-click="t('configSyncTab.trackExport')"
            @click="doExport"
          >
            {{ t('configSyncTab.btnExport') }}
          </el-button>
        </footer>
      </section>

      <!-- 流向连接(>=1100px 显示) -->
      <div class="sync__connector" aria-hidden="true">
        <span class="sync__connector-line"></span>
        <span class="sync__connector-icon"
          ><el-icon><Right /></el-icon
        ></span>
        <span class="sync__connector-line"></span>
      </div>

      <!-- ─── 目标 ─────────────────────────────────────── -->
      <section class="sync__pane" :aria-label="t('configSyncTab.targetTitle')">
        <header class="sync__head">
          <span class="sync__step">02</span>
          <div class="sync__head-text">
            <span class="sync__title">{{ t('configSyncTab.targetTitle') }}</span>
            <span class="sync__subtitle">{{ targetTenantsSubtitle }}</span>
          </div>
        </header>

        <div class="sync__body">
          <el-form label-width="56px" class="sync__form" size="default">
            <el-form-item :label="t('configSyncTab.targetEnvLabel')">
              <el-input
                v-model="targetEnv"
                :placeholder="t('configSyncTab.targetEnvPlaceholder')"
              />
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
                :rows="7"
                :placeholder="t('configSyncTab.payloadPlaceholder')"
                class="sync__payload"
              />
            </el-form-item>
          </el-form>
        </div>

        <footer class="sync__footer">
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
            type="primary"
            :loading="importing"
            :disabled="!importPayload.trim()"
            :icon="Upload"
            class="sync__apply"
            v-track-click="t('configSyncTab.trackImport')"
            @click="doImport"
          >
            {{ t('configSyncTab.btnImport') }}
          </el-button>
        </footer>
      </section>
    </div>

    <!-- ─── 结果区(导出/差异共享) ─────────────────────── -->
    <section v-if="displayResult" class="sync__result">
      <header class="sync__result-head">
        <span class="sync__result-title">{{ displayResultTitle }}</span>
      </header>
      <JsonPreview :data="displayResult" />
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Download, Right, View, Upload } from '@element-plus/icons-vue'
  import { exportConfigSync, importConfigSync } from '@/api/configReleases'
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

  // 目标侧 header 副标题:显示当前目标租户列表的摘要
  const targetTenantsSubtitle = computed(() => {
    const list = targetTenantsText.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!list.length) return t('configSyncTab.targetCurrentTenant')
    if (list.length === 1) return list[0]
    return t('configSyncTab.targetMultiTenants', { first: list[0], n: list.length })
  })

  // 用户改了粘贴内容后,旧的差异预览就过期了 — 立即清掉避免误导
  watch(importPayload, () => {
    if (previewResult.value) previewResult.value = null
  })

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
    let bundle: unknown
    try {
      bundle = JSON.parse(importPayload.value)
    } catch {
      ElMessage.error(t('configSyncTab.errInvalidJson'))
      return
    }
    previewing.value = true
    try {
      // 用 import + dryRun 做真正的"按粘贴 JSON 预览差异",
      // 旧的 previewConfigSync 不接受 bundle,会按"从源租户重新算"做预览,
      // 用户粘贴/编辑过的 JSON 不会被实际预览到。
      previewResult.value = await importConfigSync({
        tenantId: tenant.tenantId,
        sourceEnv: sourceEnv.value.trim() || 'default',
        targetEnv: targetEnv.value.trim() || 'default',
        targetTenantIds: resolvedTargetTenants(),
        bundle,
        dryRun: true,
      })
    } catch {
      ElMessage.error(t('configSyncTab.errPreviewFailed'))
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
    gap: 20px;
  }

  /* 顶部说明:纯文字,不再用色块抢视觉 */
  .sync__hint {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: 13px;
    line-height: 1.65;
  }

  /* 双栏布局:>=1100px 才显示连接线 */
  .sync__flow {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    align-items: stretch;
  }

  @media (min-width: 1100px) {
    .sync__flow {
      grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
      gap: 0;
    }
  }

  /* Pane:纯中性边框 + 微弱底色,不再用主题色边框喧宾夺主 */
  .sync__pane {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .sync__pane:hover {
    border-color: color-mix(in srgb, var(--color-border) 90%, var(--color-text-primary) 10%);
  }

  /* Pane 头部:序号 + 标题 + 副标题(租户名) */
  .sync__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px 10px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .sync__step {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.4px;
    font-variant-numeric: tabular-nums;
  }

  .sync__head-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .sync__title {
    font-size: 14px;
    font-weight: 650;
    color: var(--color-text-primary);
    line-height: 1.35;
  }

  .sync__subtitle {
    font-family: var(--font-family-mono, ui-monospace, Menlo, Monaco, Consolas, monospace);
    font-size: 11.5px;
    color: var(--color-text-tertiary);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 内容区:占满中间,使 footer 自动贴底 */
  .sync__body {
    flex: 1;
    padding: 16px 18px 4px;
  }

  .sync__form {
    --el-form-label-color: var(--color-text-secondary);
  }

  .sync__form :deep(.el-form-item) {
    margin-bottom: 14px;
  }

  /* 配置类型 checkbox 网格 */
  .sync__types {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 8px 12px;
    width: 100%;
  }

  .sync__types :deep(.el-checkbox) {
    margin-right: 0;
    height: auto;
    line-height: 1.5;
  }

  .sync__types-hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  /* JSON textarea:等宽字体 + 浅底 */
  .sync__payload :deep(.el-textarea__inner) {
    font-family: var(--font-family-mono, ui-monospace, Menlo, Monaco, Consolas, monospace);
    font-size: 12px;
    line-height: 1.55;
    background: color-mix(in srgb, var(--color-bg-canvas) 60%, var(--color-bg-card) 40%);
    min-height: 168px;
  }

  /* 底部操作区:两边一致地右对齐 + 上边线 */
  .sync__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-canvas) 40%, var(--color-bg-card) 60%);
  }

  /* 应用按钮:走 danger 色,但不用 type=danger(避免 hover 状态不一致);
     disabled 时回灰,避免"按不动还红着"的歧义 */
  .sync__apply:not(.is-disabled) {
    background: var(--color-danger);
    border-color: var(--color-danger);
  }

  .sync__apply:not(.is-disabled):hover,
  .sync__apply:not(.is-disabled):focus {
    background: color-mix(in srgb, var(--color-danger) 88%, #000 12%);
    border-color: color-mix(in srgb, var(--color-danger) 88%, #000 12%);
  }

  /* 流向连接:窄屏纵向(短),宽屏横向(铺满中间列) */
  .sync__connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
  }

  .sync__connector-line {
    flex: 1;
    width: 2px;
    min-height: 12px;
    background: color-mix(in srgb, var(--color-border) 70%, transparent);
  }

  .sync__connector-icon {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 6px 0;
    /* 窄屏 icon 朝下,宽屏朝右 */
    transform: rotate(90deg);
  }

  @media (min-width: 1100px) {
    .sync__connector {
      flex-direction: row;
      padding: 0 4px;
    }

    .sync__connector-line {
      width: auto;
      height: 2px;
      min-height: 0;
      min-width: 12px;
    }

    .sync__connector-icon {
      transform: none;
      margin: 0 6px;
    }
  }

  /* 结果区:全宽,中性卡片样式 */
  .sync__result {
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
    overflow: hidden;
  }

  .sync__result-head {
    padding: 12px 18px;
    border-bottom: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-canvas) 40%, var(--color-bg-card) 60%);
  }

  .sync__result-title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .sync__result :deep(.json-preview) {
    margin: 0;
    border-radius: 0;
  }
</style>
