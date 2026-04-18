<template>
  <PageContainer>
    <PageHeader title="配置同步" description="配置导出、导入预览与同步日志。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="导出" name="export">
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
          <pre v-if="exportResult" class="json-preview">{{
            JSON.stringify(exportResult, null, 2)
          }}</pre>
        </el-tab-pane>

        <el-tab-pane label="导入预览" name="preview">
          <div class="form-panel">
            <el-form label-width="100px" class="form-section">
              <el-form-item label="Payload">
                <el-input
                  v-model="importPayload"
                  type="textarea"
                  :rows="6"
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
          <pre v-if="previewResult" class="json-preview">{{
            JSON.stringify(previewResult, null, 2)
          }}</pre>
        </el-tab-pane>

        <el-tab-pane label="同步日志" name="logs">
          <div class="section-toolbar">
            <el-button :loading="loadingLogs" @click="loadLogs">刷新</el-button>
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
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    exportConfigSync,
    previewConfigSync,
    importConfigSync,
    listConfigSyncLogs,
  } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const activeTab = ref('export')
  const exporting = ref(false)
  const previewing = ref(false)
  const importing = ref(false)
  const loadingLogs = ref(false)

  const exportTypes = ref('')
  const exportResult = ref<unknown>(null)
  const importPayload = ref('')
  const previewResult = ref<unknown>(null)
  const syncLogs = ref<Record<string, unknown>[]>([])

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

  async function loadLogs() {
    loadingLogs.value = true
    try {
      const data = await listConfigSyncLogs(tenant.tenantId)
      syncLogs.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      syncLogs.value = []
    } finally {
      loadingLogs.value = false
    }
  }

  useTenantReload(() => {
    exportResult.value = null
    previewResult.value = null
    syncLogs.value = []
    void loadLogs()
  })
</script>

<style scoped>
  .json-preview {
    margin-top: var(--page-block-gap);
  }
</style>
