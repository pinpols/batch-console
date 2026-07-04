<template>
  <PageContainer>
    <PageHeader />

    <!-- 还原设计:内容直铺底色,无外层卡片壳 -->
    <div>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="load"
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
            <el-form-item :label="t('batchDayList.calendarLabel')" required>
              <el-select
                class="query-w-200"
                v-model="filters.calendarCode"
                filterable
                allow-create
                default-first-option
                :placeholder="t('batchDayList.calendarPlaceholder')"
              >
                <el-option v-for="c in calendarCodeOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('batchDayList.startLabel')">
              <el-date-picker
                v-model="filters.from"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('batchDayList.startPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('batchDayList.endLabel')">
              <el-date-picker
                v-model="filters.to"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="t('batchDayList.endPlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="bizDate" :label="t('batchDayList.colBizDate')" width="120">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/scheduler/batch-days/${row.bizDate}`">
              {{ row.bizDate }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="dayStatus" :label="t('batchDayList.colDayStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.dayStatus ?? '')" category="batchDay" />
          </template>
        </el-table-column>
        <el-table-column prop="slaStatus" :label="t('batchDayList.colSlaStatus')" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.slaStatus ?? '')" category="sla" />
          </template>
        </el-table-column>
        <el-table-column
          prop="totalJobCount"
          :label="t('batchDayList.colTotal')"
          width="88"
          align="right"
        />
        <el-table-column
          prop="successJobCount"
          :label="t('batchDayList.colSuccess')"
          width="72"
          align="right"
        />
        <el-table-column
          prop="failedJobCount"
          :label="t('batchDayList.colFailed')"
          width="72"
          align="right"
        />
        <el-table-column
          prop="inFlightJobCount"
          :label="t('batchDayList.colInFlight')"
          width="88"
          align="right"
        />
        <el-table-column
          prop="lateCount"
          :label="t('batchDayList.colLate')"
          width="72"
          align="right"
        />
        <el-table-column
          prop="catchupCount"
          :label="t('batchDayList.colCatchup')"
          width="96"
          align="right"
        />
        <DatetimeColumn prop="openAt" :label="t('batchDayList.colOpen')" width="160" />
        <DatetimeColumn prop="cutoffAt" :label="t('batchDayList.colCutoff')" width="160" />
        <DatetimeColumn prop="settledAt" :label="t('batchDayList.colSettled')" width="160" />
        <DatetimeColumn prop="slaDeadlineAt" :label="t('batchDayList.colSla')" width="160" />
        <el-table-column :label="t('batchDayList.colActions')" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="goWindow(row.bizDate)">
                {{ t('batchDayList.actionWindow') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { queryBatchDays } from '@/api/batchDays'
  import { useMetaCalendarsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
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
  const pageSize = ref(15)
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

  const loadError = ref<unknown>(null)
  async function load() {
    const cal = filters.calendarCode.trim()
    if (!cal) {
      ElMessage.warning(t('batchDayList.requireCalendar'))
      return
    }
    loading.value = true
    loadError.value = null
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
