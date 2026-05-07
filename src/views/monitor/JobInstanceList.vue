<template>
  <PageContainer>
    <PageHeader
      title="Job Instance 列表"
      description="分页查询实例；Job Code 从定义接口拉取下拉，亦可手输未列出的编码。"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        @change="loadData"
      >
        <template #query>
          <ListPageQueryBar
            :model="query"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="searchInstances"
            @reset="resetQuery"
            @refresh="() => runRefresh(loadData)"
          >
            <el-form-item>
              <template #label>
                <HelpLabel tip="唯一作业标识，用于调度触发和实例关联">Job Code</HelpLabel>
              </template>
              <el-select
                class="query-w-200"
                v-model="query.jobCode"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 jobCode"
              >
                <el-option v-for="code in jobCodeOptions" :key="code" :label="code" :value="code" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-180"
                v-model="query.instanceStatus"
                clearable
                filterable
                placeholder="全部实例状态"
              >
                <el-option
                  v-for="option in statusOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel tip="按实例创建或执行时间范围筛选">时间范围</HelpLabel>
              </template>
              <el-date-picker
                class="query-w-260"
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                @change="onDateChange"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="instanceNo" label="实例编号" width="180">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/job-instances/${row.id}`">
              {{ row.instanceNo }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="jobCode" label="Job Code" width="140">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/jobs/definitions?jobCode=${row.jobCode}`">
              {{ row.jobCode }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :value="row.instanceStatus" />
          </template>
        </el-table-column>
        <el-table-column prop="bizDate" label="业务日" width="110" />
        <DatetimeColumn prop="startedAt" label="开始时间" width="160" />
        <el-table-column label="耗时" width="120">
          <template #default="{ row }">
            <span>{{ formatDurationMs(calcDurationMs(row.startedAt, row.finishedAt)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="viewDetail(row)">详情</el-button>
              <el-button size="small" plain @click="viewPartitions(row)">步骤</el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { instanceApi } from '@/api/instance'
  import { jobApi } from '@/api/job'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const router = useRouter()
  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  const dateRange = ref<[string, string] | null>(null)
  const jobCodeOptions = ref<string[]>([])

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 20,
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const statusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'instanceStatus'))

  async function loadJobCodes() {
    // 仅用于下拉"常用 jobCode"提示，取前 500 条即可；超过 500 的租户让用户手输或搜索
    // （旧实现走 fetchAllPageItems，大租户会拉回万级数据，浪费带宽）
    try {
      const paged = await jobApi.listDefinitionsPaged({
        tenantId: tenant.tenantId,
        pageNo: 1,
        pageSize: 500,
      })
      jobCodeOptions.value = [...new Set(paged.records.map((d) => d.jobCode).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      )
    } catch {
      jobCodeOptions.value = []
    }
  }

  function onDateChange(val: [string, string] | null) {
    query.startDate = val?.[0] ?? ''
    query.endDate = val?.[1] ?? ''
    query.page = 1
    loadData()
  }

  function resetQuery() {
    return runReset(async () => {
      query.tenantId = tenant.tenantId
      query.jobCode = ''
      query.instanceStatus = ''
      query.startDate = ''
      query.endDate = ''
      dateRange.value = null
      query.page = 1
      syncFiltersToUrl()
      await loadData()
    })
  }

  function searchInstances() {
    return runSearch(async () => {
      query.page = 1
      syncFiltersToUrl()
      await loadData()
    })
  }

  async function loadData() {
    loading.value = true
    try {
      const result = await instanceApi.list(query)
      rows.value = result.records
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (query.jobCode) params.jobCode = query.jobCode
    if (query.instanceStatus) params.status = query.instanceStatus
    if (query.startDate) params.startDate = query.startDate
    if (query.endDate) params.endDate = query.endDate
    void router.replace({ query: params })
  }

  function viewDetail(row: ConsoleJobInstanceResponse) {
    router.push(`/monitor/job-instances/${row.id}`)
  }

  function viewPartitions(row: ConsoleJobInstanceResponse) {
    router.push(`/monitor/job-instances/${row.id}/partitions`)
  }

  function toEpochMs(v: unknown): number | null {
    if (v == null) return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (!s) return null
    const t = Date.parse(s)
    return Number.isFinite(t) ? t : null
  }

  function calcDurationMs(startedAt: unknown, finishedAt: unknown): number | null {
    const start = toEpochMs(startedAt)
    if (start == null) return null
    const end = toEpochMs(finishedAt) ?? Date.now()
    const d = end - start
    return d >= 0 ? d : null
  }

  function formatDurationMs(ms: number | null): string {
    if (ms == null) return '-'
    const sec = Math.floor(ms / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
    return `${s}s`
  }

  useSseAutoReload({
    domain: 'job-instances',
    reload: loadData,
    scope: () => tenant.tenantId,
  })

  {
    const q = route.query
    if (q.status) query.instanceStatus = String(q.status)
    if (q.jobCode) query.jobCode = String(q.jobCode)
    if (q.startDate) query.startDate = String(q.startDate)
    if (q.endDate) query.endDate = String(q.endDate)
    if (query.startDate && query.endDate) {
      dateRange.value = [query.startDate, query.endDate]
    }
  }

  useTenantReload(() => {
    query.tenantId = tenant.tenantId
    query.page = 1
    void loadJobCodes()
    void loadData()
  })
</script>
