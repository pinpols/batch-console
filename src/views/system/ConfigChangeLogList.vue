<template>
  <PageContainer>
    <PageHeader
      title="配置变更日志 & Secrets"
      description="配置变更审计日志、Secret 版本管理与轮转。"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
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
      </el-tabs>
    </SectionCard>

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
  import { ref, computed, onMounted, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    listConfigChangeLogs,
    listSecrets,
    getSecretVersion,
    rotateSecret,
  } from '@/api/configReleases'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
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
  const loadingLogs = ref(false)
  const loadingSecrets = ref(false)
  const secretDetailVisible = ref(false)

  const logRows = ref<ConsoleConfigChangeLogResponse[]>([])
  const logPage = ref(1)
  const logPageSize = ref(20)
  const pagedLogs = computed(() => toPageResult(logRows.value, logPage.value, logPageSize.value))

  const secretRows = ref<ConsoleSecretVersionResponse[]>([])
  const secretPage = ref(1)
  const secretPageSize = ref(20)
  const pagedSecrets = computed(() =>
    toPageResult(secretRows.value, secretPage.value, secretPageSize.value),
  )
  const secretDetail = ref<ConsoleSecretVersionResponse | null>(null)

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

  function loadAll() {
    void loadLogs()
    void loadSecrets()
  }

  watch(
    () => tenant.tenantId,
    () => {
      logPage.value = 1
      secretPage.value = 1
      loadAll()
    },
  )
  onMounted(loadAll)
</script>

<style scoped></style>
