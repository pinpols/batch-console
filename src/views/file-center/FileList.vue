<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        column-config-id="file-list"
        :column-defs="columnDefs"
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
            <el-form-item :label="t('fileList.fileName')">
              <el-input
                class="query-w-220"
                v-model="filters.fileName"
                clearable
                :placeholder="t('fileList.fileNamePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.fileId')">
              <el-input
                class="query-w-120"
                v-model="filters.fileId"
                clearable
                :placeholder="t('fileList.fileIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.bizType')">
              <MetaSelect
                class="query-w-160"
                v-model="filters.bizType"
                clearable
                filterable
                :placeholder="t('fileList.bizTypePlaceholder')"
                :options="bizTypeOptions"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.statusLabel')">
              <MetaSelect
                class="query-w-160"
                v-model="filters.fileStatus"
                clearable
                filterable
                enum-key="fileStatus"
                :placeholder="t('fileList.statusPlaceholder')"
                :options="fileStatusSelectOptions"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.bizDate')">
              <DateRangePresetPicker
                v-model="bizDateRange"
                type="daterange"
                default-preset="7d"
              />
            </el-form-item>
            <el-form-item :label="t('fileList.trace')">
              <TraceIdInput
                class="query-w-240"
                v-model="filters.traceId"
                :placeholder="t('fileList.tracePlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('fileList.emptyTitle')"
            :description="t('fileList.emptyDescription')"
            :image-size="80"
          >
            <template #action>
              <el-button type="primary" @click="$router.push('/files/templates')">
                {{ t('fileList.emptyGoTemplates') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <template #default="{ isColVisible }">
        <el-table-column v-if="isColVisible('id')" prop="id" label="ID" width="90" />
        <el-table-column
          v-if="isColVisible('fileName')"
          prop="fileName"
          :label="t('fileList.fileName')"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column prop="fileStatus" :label="t('fileList.statusLabel')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.fileStatus ?? '')" category="file" />
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColVisible('bizType')"
          prop="bizType"
          :label="t('fileList.bizType')"
          width="120"
        />
        <el-table-column
          v-if="isColVisible('bizDate')"
          prop="bizDate"
          :label="t('fileList.bizDate')"
          width="110"
        />
        <el-table-column
          v-if="isColVisible('traceId')"
          prop="traceId"
          :label="t('fileList.trace')"
          width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn
          v-if="isColVisible('createdAt')"
          prop="createdAt"
          :label="t('fileList.colCreatedAt')"
          width="160"
        />
        <el-table-column :label="t('fileList.colActions')" width="320" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" :inline-limit="3" />
          </template>
        </el-table-column>
        </template>
      </ProTable>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('fileList.detailTitle')"
      size="800px"
    >
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="tenantId">{{ detail.tenantId }}</el-descriptions-item>
        <el-descriptions-item label="fileName">{{ detail.fileName }}</el-descriptions-item>
        <el-descriptions-item label="fileStatus">{{ detail.fileStatus }}</el-descriptions-item>
        <el-descriptions-item label="bizType">{{ detail.bizType }}</el-descriptions-item>
        <el-descriptions-item label="bizDate">{{ detail.bizDate }}</el-descriptions-item>
        <el-descriptions-item label="traceId" :span="2">
          <router-link
            v-if="detail.traceId"
            class="cell-link"
            :to="`/observability/trace?traceId=${detail.traceId}`"
          >
            {{ detail.traceId }}
          </router-link>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="createdAt">{{ detail.createdAt }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt">{{ detail.updatedAt }}</el-descriptions-item>
        <el-descriptions-item :label="t('fileList.detailRawResponse')" :span="2">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="auditVisible" :title="t('fileList.auditTitle')" width="800px">
      <el-table
        v-loading="loading"
        :data="pagedAuditRows.records"
        border
        size="small"
        height="420"
        :empty-text="t('fileList.auditEmpty')"
        highlight-current-row
        class="console-table"
      >
        <DatetimeColumn prop="createdAt" :label="t('fileList.auditTime')" width="160" />
        <el-table-column
          prop="operationType"
          :label="t('fileList.auditOperationType')"
          width="120"
        />
        <el-table-column
          prop="operationResult"
          :label="t('fileList.auditOperationResult')"
          width="120"
        />
        <el-table-column prop="operatorType" :label="t('fileList.auditOperatorType')" width="110" />
        <el-table-column prop="operatorId" :label="t('fileList.auditOperatorId')" width="120" />
        <el-table-column
          prop="traceId"
          :label="t('fileList.trace')"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="evidenceRef"
          :label="t('fileList.auditEvidence')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detailSummary"
          :label="t('fileList.auditDetailSummary')"
          min-width="180"
          show-overflow-tooltip
        />
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
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { fileApi } from '@/api/file'
  import { useTenantStore } from '@/stores/tenant'
  import { useRoute } from 'vue-router'
  import { useTenantReload } from '@/composables/useTenantReload'

  const route = useRoute()
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes } from '@/api/meta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleAuditLogResponse, ConsoleFileRecordResponse } from '@/types/console-api'

  const tenant = useTenantStore()

  // 列设置:状态/操作列始终显示;工程字段(ID/Trace/创建时间)默认隐藏
  const columnDefs = computed(() => [
    { key: 'id', label: 'ID', defaultHidden: true },
    { key: 'fileName', label: t('fileList.fileName') },
    { key: 'bizType', label: t('fileList.bizType') },
    { key: 'bizDate', label: t('fileList.bizDate') },
    { key: 'traceId', label: t('fileList.trace'), defaultHidden: true },
    { key: 'createdAt', label: t('fileList.colCreatedAt'), defaultHidden: true },
  ])

  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleFileRecordResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const detailVisible = ref(false)
  const auditVisible = ref(false)
  const detail = ref<Record<string, unknown> | null>(null)
  const auditRows = ref<ConsoleAuditLogResponse[]>([])
  const auditPage = ref(1)
  const auditPageSize = ref(15)
  // 列表筛选默认锚到「近 7 天 + 全部状态」:文件 biz_date 多为 T-1 及更早,默认只看
  // "今天单日"(start==end)常空屏(当天尚无文件到达时尤甚)。近 7 天更贴合运维诉求;
  // 需精确单日用户自行收窄。
  function recentRange(days = 7): [string, string] {
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    }
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    return [fmt(start), fmt(end)]
  }
  const initialBizRange = recentRange()
  const bizDateRange = ref<[string, string] | null>(initialBizRange)
  // 接受深链 ?fileId=xxx / ?traceId=xxx 跳入,自动套用筛选
  const initialFileId = (route.query.fileId as string) || ''
  const initialTraceId = (route.query.traceId as string) || ''
  const filters = reactive({
    tenantId: tenant.tenantId,
    fileStatus: '',
    bizType: '',
    fileName: '',
    traceId: initialTraceId,
    fileId: initialFileId,
    startDate: initialBizRange[0],
    endDate: initialBizRange[1],
  })

  // 行操作:1 主 + 4 次,折进"更多"避免一行 5 个 plain 按钮
  function rowActions(row: ConsoleFileRecordResponse): RowAction[] {
    return [
      {
        key: 'detail',
        label: t('fileList.actionDetail'),
        primary: true,
        onClick: () => openDetail(row),
      },
      { key: 'audit', label: t('fileList.actionAudit'), onClick: () => openAudit(row) },
      { key: 'download', label: t('fileList.actionDownload'), onClick: () => downloadFile(row) },
      {
        key: 'redispatch',
        label: t('fileList.actionRedispatch'),
        divided: true,
        onClick: () => redispatchFile(row),
      },
      {
        key: 'archive',
        label: t('fileList.actionArchive'),
        danger: true,
        onClick: () => archiveFile(row),
      },
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
        ...filters,
        // 顺序后置:filters.tenantId 为空时回退到当前租户(避免 spread 覆盖)
        tenantId: filters.tenantId || tenant.tenantId,
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
      // traceId 是全局唯一键,搜它时清掉默认的今日日期锚定——否则别的业务日的文件被日期挡掉
      // 搜不到(与实例列表 JobInstanceList 同款修复)。
      if (filters.traceId?.trim()) {
        filters.startDate = ''
        filters.endDate = ''
        bizDateRange.value = null
      }
      page.value = 1
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      const t = recentRange()
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
    detail.value = await fileApi.detail(row.id, row.tenantId ?? tenant.tenantId)
    detailVisible.value = true
  }

  async function openAudit(row: ConsoleFileRecordResponse) {
    auditPage.value = 1
    auditRows.value = await fileApi.audit(row.id, row.tenantId ?? tenant.tenantId)
    auditVisible.value = true
  }

  watch([auditRows, auditPageSize], () => {
    const total = auditRows.value.length
    const max = Math.max(1, Math.ceil(total / auditPageSize.value) || 1)
    if (auditPage.value > max) auditPage.value = max
  })

  async function downloadFile(row: ConsoleFileRecordResponse) {
    try {
      const res = await fileApi.download(row.id, row.tenantId ?? tenant.tenantId)
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = row.fileName || `file-${row.id}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      ElMessage.error(t('fileList.downloadFail'))
    }
  }

  async function redispatchFile(row: ConsoleFileRecordResponse) {
    try {
      await ElMessageBox.confirm(
        t('fileList.redispatchConfirm', { id: row.id, name: row.fileName }),
        t('fileList.redispatchTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await fileApi.redispatch({ tenantId: row.tenantId ?? tenant.tenantId, fileId: row.id })
      ElMessage.success(t('fileList.redispatchSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function archiveFile(row: ConsoleFileRecordResponse) {
    try {
      await confirmDanger({
        verb: t('fileList.archiveVerb'),
        target: t('fileList.archiveTarget', { name: row.fileName }),
        consequence: t('fileList.archiveConsequence'),
        irreversible: false,
      })
      await fileApi.archive({ tenantId: row.tenantId ?? tenant.tenantId, fileId: row.id })
      ElMessage.success(t('fileList.archiveSuccess'))
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
