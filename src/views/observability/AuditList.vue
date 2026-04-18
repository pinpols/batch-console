<template>
  <PageContainer>
    <PageHeader
      title="审计日志"
      description="全量审计与本地筛选；操作类型与结果优先 meta/enums，并与当前数据中的新值合并。"
    />

    <SectionCard>
      <div v-if="lastTrace" class="trace-bar">
        <span>最近 traceId</span>
        <code>{{ lastTrace }}</code>
        <el-button size="small" @click="copyTrace">复制</el-button>
      </div>

      <ProTable
        :data="display as unknown as Record<string, unknown>[]"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="search"
            @reset="reset"
            @refresh="load"
          >
            <el-form-item label="Trace">
              <el-input
                v-model="filters.traceId"
                clearable
                placeholder="Trace Id，模糊匹配"
                style="width: 200px"
              />
            </el-form-item>
            <el-form-item label="操作类型">
              <el-select
                v-model="filters.operationType"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 operationType"
                style="width: 200px"
              >
                <el-option
                  v-for="o in operationTypeOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="操作者">
              <el-input
                v-model="filters.operatorId"
                clearable
                placeholder="操作人 Id，模糊匹配"
                style="width: 160px"
              />
            </el-form-item>
            <el-form-item label="File ID">
              <el-input
                v-model="filters.fileId"
                clearable
                placeholder="关联文件 Id"
                style="width: 140px"
              />
            </el-form-item>
            <el-form-item label="结果">
              <el-select
                v-model="filters.operationResult"
                clearable
                filterable
                placeholder="全部操作结果"
                style="width: 200px"
              >
                <el-option
                  v-for="opt in operationResultSelectOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="时间范围">
              <el-date-picker
                v-model="timeRange"
                type="datetimerange"
                value-format="YYYY-MM-DD HH:mm:ss"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                style="width: 340px"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <DatetimeColumn prop="createdAt" label="时间" width="160" />
        <el-table-column prop="operationType" label="操作" width="120" />
        <el-table-column prop="operationResult" label="结果" width="120" />
        <el-table-column prop="traceId" label="Trace" min-width="130" show-overflow-tooltip />
        <el-table-column prop="operatorId" label="操作者" width="120" />
        <el-table-column prop="fileId" label="File ID" width="100" />
        <el-table-column prop="detailSummary" label="摘要" min-width="180" show-overflow-tooltip />
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryAudits } from '@/api/observabilityQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { lastApiMeta } from '@/utils/lastApiMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const all = ref<ConsoleAuditLogResponse[]>([])
  const display = ref<ConsoleAuditLogResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const timeRange = ref<[string, string] | []>([])
  const filters = reactive({
    traceId: '',
    operationType: '',
    operatorId: '',
    fileId: '',
    operationResult: '',
    startTime: '',
    endTime: '',
  })

  const lastTrace = computed(() => lastApiMeta.value?.traceId ?? '')
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const operationTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationType'))

  const operationResultSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'operationResult'),
  )

  function filterAll() {
    return all.value.filter((row) => {
      if (filters.traceId.trim() && !row.traceId?.includes(filters.traceId.trim())) return false
      if (
        filters.operationType.trim() &&
        String(row.operationType ?? '') !== filters.operationType.trim()
      ) {
        return false
      }
      if (filters.operatorId.trim() && !row.operatorId?.includes(filters.operatorId.trim())) {
        return false
      }
      if (filters.fileId.trim() && !String(row.fileId ?? '').includes(filters.fileId.trim())) {
        return false
      }
      if (
        filters.operationResult.trim() &&
        String(row.operationResult ?? '').toUpperCase() !==
          filters.operationResult.trim().toUpperCase()
      ) {
        return false
      }
      const createdAt = String(row.createdAt ?? '')
      if (filters.startTime && createdAt < filters.startTime) return false
      if (filters.endTime && createdAt > filters.endTime) return false
      return true
    })
  }

  function slicePage() {
    const r = filterAll()
    total.value = r.length
    const pr = toPageResult(r, page.value, pageSize.value)
    display.value = pr.records as ConsoleAuditLogResponse[]
  }

  async function load() {
    loading.value = true
    try {
      all.value = await queryAudits(tenant.tenantId, {
        traceId: filters.traceId.trim() || undefined,
        operationType: filters.operationType.trim() || undefined,
        operatorId: filters.operatorId.trim() || undefined,
        fileId: filters.fileId.trim() || undefined,
        operationResult: filters.operationResult.trim() || undefined,
        startTime: filters.startTime || undefined,
        endTime: filters.endTime || undefined,
      })
      slicePage()
    } finally {
      loading.value = false
    }
  }

  function search() {
    return runSearch(() => {
      page.value = 1
      slicePage()
    })
  }

  function reset() {
    return runReset(() => {
      filters.traceId = ''
      filters.operationType = ''
      filters.operatorId = ''
      filters.fileId = ''
      filters.operationResult = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = []
      page.value = 1
      slicePage()
    })
  }

  function copyTrace() {
    if (!lastTrace.value) return
    void navigator.clipboard.writeText(lastTrace.value)
    ElMessage.success('已复制')
  }

  watch(timeRange, (value) => {
    filters.startTime = value[0] ?? ''
    filters.endTime = value[1] ?? ''
  })

  useTenantReload(load)
</script>

<style scoped>
  .trace-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: var(--radius-content);
    font-size: 13px;
  }

  .trace-bar code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }
</style>
