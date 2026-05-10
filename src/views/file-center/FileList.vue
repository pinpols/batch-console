<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item label="快捷">
              <el-radio-group :model-value="quickStatus" size="small" @change="onQuickStatusChange">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="processing">处理中</el-radio-button>
                <el-radio-button value="failed">失败</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="状态">
              <MetaSelect
                class="query-w-160"
                v-model="filters.fileStatus"
                clearable
                filterable
                placeholder="全部文件状态"
                :options="fileStatusSelectOptions"
              />
            </el-form-item>
            <el-form-item label="业务类型">
              <MetaSelect
                class="query-w-160"
                v-model="filters.bizType"
                clearable
                filterable
                placeholder="全部业务类型"
                :options="bizTypeOptions"
              />
            </el-form-item>
            <el-form-item label="文件名">
              <el-input
                class="query-w-160"
                v-model="filters.fileName"
                clearable
                placeholder="文件名，模糊匹配"
              />
            </el-form-item>
            <el-form-item label="Trace">
              <el-input
                class="query-w-160"
                v-model="filters.traceId"
                clearable
                placeholder="Trace Id，模糊匹配"
              />
            </el-form-item>
            <el-form-item label="File ID">
              <el-input
                class="query-w-120"
                v-model="filters.fileId"
                clearable
                placeholder="文件 Id，精确或包含"
              />
            </el-form-item>
            <el-form-item label="业务日">
              <DateRangePresetPicker
                v-model="bizDateRange"
                type="daterange"
                default-preset="today"
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
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" />
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
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="auditVisible" title="文件审计" width="880px">
      <el-table
        v-loading="loading"
        :data="pagedAuditRows.records"
        border
        size="small"
        height="420"
        empty-text="暂无审计记录"
        highlight-current-row
        class="console-table"
      >
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
        <el-table-column prop="operationType" label="操作" width="120" />
        <el-table-column prop="operationResult" label="结果" width="120" />
        <el-table-column prop="operatorType" label="操作者类型" width="110" />
        <el-table-column prop="operatorId" label="操作者" width="120" />
        <el-table-column prop="traceId" label="Trace" min-width="150" show-overflow-tooltip />
        <el-table-column prop="evidenceRef" label="证据" width="140" show-overflow-tooltip />
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
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { fileApi } from '@/api/file'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes } from '@/api/meta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleAuditLogResponse, ConsoleFileRecordResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
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
  // 列表筛选默认锚到"今日 + 全部状态";运维大多看当天文件
  function todayRange(): [string, string] {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    return [s, s]
  }
  const initialBizRange = todayRange()
  const bizDateRange = ref<[string, string] | null>(initialBizRange)
  const filters = reactive({
    tenantId: tenant.tenantId,
    fileStatus: '',
    bizType: '',
    fileName: '',
    traceId: '',
    fileId: '',
    startDate: initialBizRange[0],
    endDate: initialBizRange[1],
  })

  // 快捷状态 chip:把单值 fileStatus 映射到 全部 / 处理中 / 失败
  // 关键值参考 fileStatus enum:PROCESSING / FAILED / ARCHIVED / SUCCEEDED 等
  const quickStatus = computed<'all' | 'processing' | 'failed' | ''>(() => {
    if (!filters.fileStatus) return 'all'
    if (filters.fileStatus === 'PROCESSING') return 'processing'
    if (filters.fileStatus === 'FAILED') return 'failed'
    return ''
  })

  function onQuickStatusChange(key: string | number | boolean | undefined) {
    const k = String(key)
    filters.fileStatus = k === 'processing' ? 'PROCESSING' : k === 'failed' ? 'FAILED' : ''
    page.value = 1
    void load()
  }

  // 行操作:1 主 + 4 次,折进"更多"避免一行 5 个 plain 按钮
  function rowActions(row: ConsoleFileRecordResponse): RowAction[] {
    return [
      { key: 'detail', label: '详情', primary: true, onClick: () => openDetail(row) },
      { key: 'audit', label: '审计', onClick: () => openAudit(row) },
      { key: 'download', label: '下载', onClick: () => downloadFile(row) },
      { key: 'redispatch', label: '重投递', divided: true, onClick: () => redispatchFile(row) },
      { key: 'archive', label: '归档', danger: true, onClick: () => archiveFile(row) },
    ]
  }

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
    loadError.value = null
    try {
      const pr = await fileApi.list({
        tenantId: filters.tenantId || tenant.tenantId,
        ...filters,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function onSearch() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      const t = todayRange()
      filters.tenantId = tenant.tenantId
      filters.fileStatus = ''
      filters.bizType = ''
      filters.fileName = ''
      filters.traceId = ''
      filters.fileId = ''
      filters.startDate = t[0]
      filters.endDate = t[1]
      bizDateRange.value = t
      page.value = 1
      await load()
    })
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
      await confirmDanger({
        verb: '归档',
        target: `文件「${row.fileName}」`,
        consequence:
          '归档后该文件不再出现在列表里,正在跑的下游任务不受影响,但新触发会找不到此文件。可在管理后台按 fileId 反向查询。',
        irreversible: false,
      })
      await fileApi.archive({ tenantId: tenant.tenantId, fileId: row.id })
      ElMessage.success('已归档')
      await load()
    } catch {
      /* cancel */
    }
  }

  watch(bizDateRange, (value) => {
    filters.startDate = value?.[0] ?? ''
    filters.endDate = value?.[1] ?? ''
  })

  useTenantReload(() => {
    page.value = 1
    void load()
    void loadBizTypes()
  })
</script>

<style scoped></style>
