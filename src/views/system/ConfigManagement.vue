<template>
  <PageContainer>
    <PageHeader
      title="配置管理"
      description="配置变更审计、Secret 管理与配置导入导出同步。"
      :show-description="true"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <!-- 变更日志 -->
        <el-tab-pane label="变更日志" name="logs">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingLogs"
            :disabled="loadingLogs"
            @refresh="loadLogs"
            @search="loadLogs"
            @reset="loadLogs"
          />
          <el-table
            :data="pagedLogs.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="releaseId" label="Release ID" width="100" />
            <el-table-column prop="changeType" label="变更类型" width="120" />
            <el-table-column
              prop="configKey"
              label="配置键"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column prop="operatorId" label="操作者" width="120" />
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
            <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          </el-table>
          <TablePagerBar
            :page="logPage"
            :page-size="logPageSize"
            :total="pagedLogs.total"
            @update:page="(p: number) => (logPage = p)"
            @update:page-size="
              (s: number) => {
                logPageSize = s
                logPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Secrets -->
        <el-tab-pane label="Secrets" name="secrets">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingSecrets"
            :disabled="loadingSecrets"
            @refresh="loadSecrets"
            @search="loadSecrets"
            @reset="loadSecrets"
          />
          <el-table
            :data="pagedSecrets.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column
              prop="secretRef"
              label="Secret Key"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <CopyableText :text="String(row.secretRef ?? '')" />
              </template>
            </el-table-column>
            <el-table-column prop="versionNo" label="版本" width="80" />
            <el-table-column prop="secretStatus" label="状态" width="100" />
            <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="viewSecret(row)"
                    >详情</el-button
                  >
                  <el-button
                    size="small"
                    plain
                    type="warning"
                    v-track-click="{ action: '轮转 Secret', secretKey: row.secretRef }"
                    @click="confirmRotate(row)"
                    >轮转</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="secretPage"
            :page-size="secretPageSize"
            :total="pagedSecrets.total"
            @update:page="(p: number) => (secretPage = p)"
            @update:page-size="
              (s: number) => {
                secretPageSize = s
                secretPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- 配置同步（导出 + 导入） -->
        <el-tab-pane label="配置同步" name="sync">
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
              <div class="sync-block__desc">
                粘贴导出的 JSON。建议先“预览变更”确认差异，再执行导入。
              </div>
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
                      v-track-click="'配置同步-预览'"
                      @click="doPreview"
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
        </el-tab-pane>

        <!-- 同步日志 -->
        <el-tab-pane label="同步日志" name="syncLogs">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingSyncLogs"
            :disabled="loadingSyncLogs"
            @refresh="loadSyncLogs"
            @search="loadSyncLogs"
            @reset="loadSyncLogs"
          />
          <el-table
            :data="syncLogs"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="syncType" label="类型" width="100" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="operatorId" label="操作者" width="120" />
            <el-table-column prop="summary" label="摘要" min-width="250" show-overflow-tooltip />
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <!-- Secret 详情抽屉 -->
    <el-drawer v-model="secretDetailVisible" title="Secret 详情" size="560px">
      <el-descriptions v-if="secretDetail" :column="1" border size="small">
        <el-descriptions-item label="ID">{{ secretDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="Secret Key">{{ secretDetail.secretRef }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ secretDetail.versionNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ secretDetail.secretStatus }}</el-descriptions-item>
        <el-descriptions-item label="原始响应">
          <pre class="json-preview">{{ JSON.stringify(secretDetail, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Download } from '@element-plus/icons-vue'
  import {
    listConfigChangeLogs,
    listSecrets,
    getSecretVersion,
    rotateSecret,
    exportConfigSync,
    previewConfigSync,
    importConfigSync,
    listConfigSyncLogs,
  } from '@/api/configReleases'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import type {
    ConsoleConfigChangeLogResponse,
    ConsoleSecretVersionResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const activeTab = ref('logs')

  // ── 变更日志 ──
  const loadingLogs = ref(false)
  const logRows = ref<ConsoleConfigChangeLogResponse[]>([])
  const logPage = ref(1)
  const logPageSize = ref(20)
  const pagedLogs = computed(() => toPageResult(logRows.value, logPage.value, logPageSize.value))

  async function loadLogs() {
    loadingLogs.value = true
    try {
      logRows.value = await listConfigChangeLogs(tenant.tenantId)
    } catch {
      logRows.value = []
    } finally {
      loadingLogs.value = false
    }
  }

  // ── Secrets ──
  const loadingSecrets = ref(false)
  const secretDetailVisible = ref(false)
  const secretRows = ref<ConsoleSecretVersionResponse[]>([])
  const secretPage = ref(1)
  const secretPageSize = ref(20)
  const pagedSecrets = computed(() =>
    toPageResult(secretRows.value, secretPage.value, secretPageSize.value),
  )
  const secretDetail = ref<ConsoleSecretVersionResponse | null>(null)

  async function loadSecrets() {
    loadingSecrets.value = true
    try {
      secretRows.value = await listSecrets(tenant.tenantId)
    } catch {
      secretRows.value = []
    } finally {
      loadingSecrets.value = false
    }
  }

  async function viewSecret(row: ConsoleSecretVersionResponse) {
    secretDetail.value = (await getSecretVersion(
      row.id,
      tenant.tenantId,
    )) as ConsoleSecretVersionResponse
    secretDetailVisible.value = true
  }

  async function confirmRotate(row: ConsoleSecretVersionResponse) {
    try {
      await ElMessageBox.confirm(`轮转 Secret "${row.secretRef}"？`, '轮转确认', {
        type: 'warning',
      })
      await rotateSecret({ tenantId: tenant.tenantId, secretRef: row.secretRef })
      ElMessage.success('已发起轮转')
      await loadSecrets()
    } catch {
      /* cancel */
    }
  }

  // ── 配置导出 ──
  const exporting = ref(false)
  const exportTypes = ref<string[]>([])
  const exportResult = ref<unknown>(null)
  const exportTypeOptions = ['JOB', 'WORKFLOW', 'PIPELINE', 'FILE', 'ALERT', 'SYSTEM'] as const

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

  // ── 配置导入 ──
  const previewing = ref(false)
  const importing = ref(false)
  const importPayload = ref('')
  const previewResult = ref<unknown>(null)

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

  // ── 同步日志 ──
  const loadingSyncLogs = ref(false)
  const syncLogs = ref<Record<string, unknown>[]>([])

  async function loadSyncLogs() {
    loadingSyncLogs.value = true
    try {
      const data = await listConfigSyncLogs(tenant.tenantId)
      syncLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      syncLogs.value = []
    } finally {
      loadingSyncLogs.value = false
    }
  }

  function loadAll() {
    void loadLogs()
    void loadSecrets()
    void loadSyncLogs()
  }

  useTenantReload(() => {
    logPage.value = 1
    secretPage.value = 1
    exportResult.value = null
    previewResult.value = null
    syncLogs.value = []
    loadAll()
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

  /* 悬浮导出按钮：不占用输入框宽度 */
  .export-row__action {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  /* 给 select 右侧留出按钮空间，避免文字被遮挡 */
  .export-row :deep(.el-input__wrapper) {
    padding-right: 54px;
  }

  /* 悬浮按钮更像“下载胶囊” */
  .export-row__action {
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

  .form-actions :deep(.el-form-item__content) {
    justify-content: center;
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
