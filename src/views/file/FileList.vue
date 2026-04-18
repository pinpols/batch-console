<template>
  <PageContainer>
    <PageHeader
      title="文件列表"
      description="分页查询文件记录；状态与业务类型优先 meta/enums，缺省再回落当前页数据。"
    />

    <SectionCard>
      <ProTable
        :data="rows as unknown as Record<string, unknown>[]"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="loading"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="load"
          >
            <el-form-item label="状态">
              <el-select
                v-model="filters.fileStatus"
                clearable
                filterable
                placeholder="全部文件状态"
                style="width: 160px"
              >
                <el-option
                  v-for="o in fileStatusSelectOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="业务类型">
              <el-select
                v-model="filters.bizType"
                clearable
                filterable
                placeholder="全部业务类型"
                style="width: 160px"
              >
                <el-option
                  v-for="o in bizTypeOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="文件名">
              <el-input
                v-model="filters.fileName"
                clearable
                placeholder="文件名，模糊匹配"
                style="width: 160px"
              />
            </el-form-item>
            <el-form-item label="Trace">
              <el-input
                v-model="filters.traceId"
                clearable
                placeholder="Trace Id，模糊匹配"
                style="width: 160px"
              />
            </el-form-item>
            <el-form-item label="File ID">
              <el-input
                v-model="filters.fileId"
                clearable
                placeholder="文件 Id，精确或包含"
                style="width: 120px"
              />
            </el-form-item>
            <el-form-item label="业务日">
              <el-date-picker
                v-model="bizDateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 260px"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="fileStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.fileStatus ?? '')" category="file" />
          </template>
        </el-table-column>
        <el-table-column prop="bizType" label="业务类型" width="120" />
        <el-table-column prop="bizDate" label="业务日" width="110" />
        <el-table-column prop="traceId" label="Trace" min-width="140" show-overflow-tooltip />
        <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" min-width="168" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">详情</el-button>
              <el-button size="small" plain @click="openAudit(row)">审计</el-button>
              <el-button size="small" plain @click="downloadFile(row)">下载</el-button>
              <el-button size="small" plain type="warning" @click="redispatchFile(row)"
                >重投递</el-button
              >
              <el-button size="small" plain type="danger" @click="archiveFile(row)">归档</el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="detailVisible" title="文件详情" size="720px">
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="tenantId">{{ detail.tenantId }}</el-descriptions-item>
        <el-descriptions-item label="fileName">{{ detail.fileName }}</el-descriptions-item>
        <el-descriptions-item label="fileStatus">{{ detail.fileStatus }}</el-descriptions-item>
        <el-descriptions-item label="bizType">{{ detail.bizType }}</el-descriptions-item>
        <el-descriptions-item label="bizDate">{{ detail.bizDate }}</el-descriptions-item>
        <el-descriptions-item label="traceId" :span="2">{{ detail.traceId }}</el-descriptions-item>
        <el-descriptions-item label="createdAt">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt">{{ detail.updatedAt }}</el-descriptions-item>
        <el-descriptions-item label="原始响应" :span="2">
          <pre class="json-preview">{{ JSON.stringify(detail, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="auditVisible" title="文件审计" width="880px">
      <el-table
        :data="pagedAuditRows.records"
        border
        size="small"
        height="420"
        highlight-current-row
        class="console-table"
      >
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
        <el-table-column prop="operationType" label="操作" width="120" />
        <el-table-column prop="operationResult" label="结果" width="120" />
        <el-table-column prop="operatorId" label="操作者" width="120" />
        <el-table-column prop="traceId" label="Trace" min-width="150" show-overflow-tooltip />
        <el-table-column prop="detailSummary" label="摘要" min-width="180" show-overflow-tooltip />
      </el-table>
      <TablePagerBar
        :page="auditPage"
        :page-size="auditPageSize"
        :total="pagedAuditRows.total"
        @update:page="setAuditPage"
        @update:page-size="onAuditPageSize"
      />
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, onMounted, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { fileApi } from '@/api/file'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes } from '@/api/meta'
  import type { ConsoleAuditLogResponse, ConsoleFileRecordResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleFileRecordResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const detailVisible = ref(false)
  const auditVisible = ref(false)
  const detail = ref<Record<string, unknown> | null>(null)
  const auditRows = ref<ConsoleAuditLogResponse[]>([])
  const auditPage = ref(1)
  const auditPageSize = ref(20)
  const bizDateRange = ref<[string, string] | []>([])
  const filters = reactive({
    tenantId: tenant.tenantId,
    fileStatus: '',
    bizType: '',
    fileName: '',
    traceId: '',
    fileId: '',
    startDate: '',
    endDate: '',
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const fileStatusSelectOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'fileStatus'))

  const bizTypeOptions = ref<{ value: string; label: string }[]>([])

  async function loadBizTypes() {
    try {
      bizTypeOptions.value = await getMetaBizTypes(tenant.tenantId)
    } catch {
      bizTypeOptions.value = []
    }
  }

  const pagedAuditRows = computed(() =>
    toPageResult(auditRows.value, auditPage.value, auditPageSize.value),
  )

  function setAuditPage(p: number) {
    auditPage.value = p
  }

  function onAuditPageSize(s: number) {
    auditPageSize.value = s
    auditPage.value = 1
  }

  async function load() {
    loading.value = true
    try {
      const pr = await fileApi.list({
        tenantId: filters.tenantId || tenant.tenantId,
        ...filters,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } finally {
      loading.value = false
    }
  }

  function onSearch() {
    page.value = 1
    void load()
  }

  function reset() {
    filters.tenantId = tenant.tenantId
    filters.fileStatus = ''
    filters.bizType = ''
    filters.fileName = ''
    filters.traceId = ''
    filters.fileId = ''
    filters.startDate = ''
    filters.endDate = ''
    bizDateRange.value = []
    page.value = 1
    void load()
  }

  async function openDetail(row: ConsoleFileRecordResponse) {
    detail.value = await fileApi.detail(row.id, tenant.tenantId)
    detailVisible.value = true
  }

  async function openAudit(row: ConsoleFileRecordResponse) {
    auditPage.value = 1
    auditRows.value = await fileApi.audit(row.id, tenant.tenantId)
    auditVisible.value = true
  }

  watch([auditRows, auditPageSize], () => {
    const total = auditRows.value.length
    const max = Math.max(1, Math.ceil(total / auditPageSize.value) || 1)
    if (auditPage.value > max) auditPage.value = max
  })

  async function downloadFile(row: ConsoleFileRecordResponse) {
    try {
      const res = await fileApi.download(row.id, tenant.tenantId)
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = row.fileName || `file-${row.id}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      ElMessage.error('下载失败')
    }
  }

  async function redispatchFile(row: ConsoleFileRecordResponse) {
    try {
      await ElMessageBox.confirm(`重投递文件 #${row.id}（${row.fileName}）？`, '重投递确认', {
        type: 'warning',
      })
      await fileApi.redispatch({ tenantId: tenant.tenantId, fileId: row.id })
      ElMessage.success('已发起重投递')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function archiveFile(row: ConsoleFileRecordResponse) {
    try {
      await ElMessageBox.confirm(`归档文件 #${row.id}（${row.fileName}）？`, '归档确认', {
        type: 'warning',
      })
      await fileApi.archive({ tenantId: tenant.tenantId, fileId: row.id })
      ElMessage.success('已归档')
      await load()
    } catch {
      /* cancel */
    }
  }

  watch(bizDateRange, (value) => {
    filters.startDate = value[0] ?? ''
    filters.endDate = value[1] ?? ''
  })

  watch(
    () => tenant.tenantId,
    () => {
      page.value = 1
      void load()
      void loadBizTypes()
    },
  )

  onMounted(() => {
    void load()
    void loadBizTypes()
  })
</script>

<style scoped></style>
