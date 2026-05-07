<template>
  <PageContainer>
    <PageHeader
      title="批次日历日"
      description="按日历编码与日期区间分页查询；日历编码优先从治理「日历」接口同步下拉。"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
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
            <el-form-item label="日历" required>
              <el-select
                class="query-w-200"
                v-model="filters.calendarCode"
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 calendarCode"
              >
                <el-option v-for="c in calendarCodeOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
            <el-form-item label="起始日">
              <el-date-picker
                v-model="filters.from"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="起始业务日"
              />
            </el-form-item>
            <el-form-item label="结束日">
              <el-date-picker
                v-model="filters.to"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="结束业务日"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="bizDate" label="业务日" width="120">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/scheduler/batch-days/${row.bizDate}`">
              {{ row.bizDate }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="dayStatus" label="日状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.dayStatus ?? '')" category="batchDay" />
          </template>
        </el-table-column>
        <el-table-column prop="slaStatus" label="SLA" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.slaStatus ?? '')" category="sla" />
          </template>
        </el-table-column>
        <el-table-column prop="totalJobCount" label="任务数" width="88" />
        <el-table-column prop="successJobCount" label="成功" width="72" />
        <el-table-column prop="failedJobCount" label="失败" width="72" />
        <el-table-column prop="inFlightJobCount" label="进行中" width="88" />
        <el-table-column prop="catchupCount" label="Catch-up" width="96" />
        <DatetimeColumn prop="openAt" label="开窗" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="goWindow(row.bizDate)"
                >窗口 / 补跑</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { queryBatchDays } from '@/api/batchDays'
  import { useMetaCalendarsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleBatchDayResponse } from '@/types/console-api'

  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleBatchDayResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const filters = reactive({
    calendarCode: 'DEFAULT',
    from: '' as string,
    to: '' as string,
  })

  const { data: calendarMeta } = useMetaCalendarsQuery()

  const calendarCodeOptions = computed(() => {
    const api = calendarMeta.value ?? []
    const codes = api.map((o) => o.value).filter(Boolean)
    return [...new Set([...codes, 'DEFAULT'])].sort((a, b) => a.localeCompare(b))
  })

  async function load() {
    const cal = filters.calendarCode.trim()
    if (!cal) {
      ElMessage.warning('请选择或填写日历编码')
      return
    }
    loading.value = true
    try {
      const pr = await queryBatchDays({
        tenantId: tenant.tenantId,
        calendarCode: cal,
        from: filters.from || undefined,
        to: filters.to || undefined,
        pageNo: page.value,
        pageSize: pageSize.value,
      })
      rows.value = (pr.items ?? []) as ConsoleBatchDayResponse[]
      total.value = pr.total ?? 0
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
      filters.calendarCode = 'DEFAULT'
      filters.from = ''
      filters.to = ''
      page.value = 1
      await load()
    })
  }

  function goWindow(bizDate: string) {
    router.push({
      path: `/scheduler/batch-days/${encodeURIComponent(bizDate)}`,
      query: { calendarCode: filters.calendarCode.trim() || 'DEFAULT' },
    })
  }

  useTenantReload(load)
</script>
