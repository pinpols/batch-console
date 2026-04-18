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
          <div class="section-toolbar">
            <el-button :loading="loadingLogs" @click="loadLogs">刷新</el-button>
          </div>
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
          <div class="section-toolbar">
            <el-button :loading="loadingSecrets" @click="loadSecrets">刷新</el-button>
          </div>
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

        <!-- 配置导出 -->
        <el-tab-pane label="配置导出" name="export">
          <div class="form-panel">
            <el-form label-width="100px" class="form-section">
              <el-form-item label="配置类型">
                <el-input
                  v-model="exportTypes"
                  placeholder="逗号分隔，如 JOB,WORKFLOW；留空导出全部"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="exporting"
                  v-track-click="'配置同步-导出'"
                  @click="doExport"
                  >导出</el-button
                >
              </el-form-item>
            </el-form>
          </div>
          <pre v-if="exportResult" class="json-preview" style="margin-top: var(--space-md)">{{
            JSON.stringify(exportResult, null, 2)
          }}</pre>
        </el-tab-pane>

        <!-- 配置导入 -->
        <el-tab-pane label="配置导入" name="import">
          <div class="form-panel">
            <el-form label-width="100px">
              <el-form-item label="Payload">
                <el-input
                  v-model="importPayload"
                  type="textarea"
                  :rows="8"
                  placeholder="粘贴导出的 JSON"
                />
              </el-form-item>
              <el-form-item>
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
          <pre v-if="previewResult" class="json-preview" style="margin-top: var(--space-md)">{{
            JSON.stringify(previewResult, null, 2)
          }}</pre>
        </el-tab-pane>

        <!-- 同步日志 -->
        <el-tab-pane label="同步日志" name="syncLogs">
          <div class="section-toolbar">
            <el-button :loading="loadingSyncLogs" @click="loadSyncLogs">刷新</el-button>
          </div>
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
  const exportTypes = ref('')
  const exportResult = ref<unknown>(null)

  async function doExport() {
    exporting.value = true
    try {
      const types = exportTypes.value.trim()
      const body: { tenantId: string; configTypes?: string[] } = { tenantId: tenant.tenantId }
      if (types) body.configTypes = types.split(',').map((s) => s.trim())
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

<style scoped></style>
