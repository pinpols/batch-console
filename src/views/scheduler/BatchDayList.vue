<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-segmented v-model="viewMode" :options="viewModeOptions" />
      </template>
    </PageHeader>

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
      <template v-if="viewMode === 'table'">
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
      </template>
    </ListPageQueryBar>

    <section v-if="viewMode === 'calendar'" class="batch-calendar" v-loading="loading">
      <div class="batch-calendar__summary" :aria-label="t('batchDayList.calendarSummary')">
        <div class="batch-calendar__metric">
          <span>{{ t('batchDayList.metricDays') }}</span>
          <strong>{{ calendarSummary.days }}</strong>
        </div>
        <div class="batch-calendar__metric">
          <span>{{ t('batchDayList.metricJobs') }}</span>
          <strong>{{ calendarSummary.totalJobs }}</strong>
        </div>
        <div class="batch-calendar__metric batch-calendar__metric--danger">
          <span>{{ t('batchDayList.metricFailed') }}</span>
          <strong>{{ calendarSummary.failed }}</strong>
        </div>
        <div class="batch-calendar__metric batch-calendar__metric--warning">
          <span>{{ t('batchDayList.metricInFlightLate') }}</span>
          <strong>{{ calendarSummary.inFlight }} / {{ calendarSummary.late }}</strong>
        </div>
      </div>

      <el-alert
        v-if="loadError"
        type="error"
        :closable="false"
        show-icon
        :title="t('batchDayList.loadFailed')"
      />

      <div
        v-if="!loading && !loadError && calendarSummary.days === 0"
        class="batch-calendar__empty"
        role="status"
      >
        <div>
          <strong>{{ t('batchDayList.emptyMonthTitle') }}</strong>
          <span>{{ t('batchDayList.emptyMonthDescription') }}</span>
        </div>
        <el-button size="small" plain type="primary" @click="viewMode = 'table'">
          {{ t('batchDayList.viewTable') }}
        </el-button>
      </div>

      <el-calendar v-model="calendarDate" class="batch-calendar__grid">
        <template #date-cell="{ data }">
          <button
            type="button"
            class="batch-calendar__day"
            :class="{ 'batch-calendar__day--outside': data.type !== 'current-month' }"
            :disabled="!calendarDay(data.day)"
            @click.stop="calendarDay(data.day) && goWindow(data.day)"
          >
            <span class="batch-calendar__date">{{ Number(data.day.slice(-2)) }}</span>
            <template v-for="day in [calendarDay(data.day)]" :key="data.day">
              <template v-if="day">
                <StatusTag :value="String(day.dayStatus ?? '')" category="batchDay" />
                <span class="batch-calendar__counts">
                  {{
                    t('batchDayList.calendarCellCounts', {
                      success: day.successJobCount ?? 0,
                      failed: day.failedJobCount ?? 0,
                      running: day.inFlightJobCount ?? 0,
                    })
                  }}
                </span>
                <span v-if="day.lateCount" class="batch-calendar__late">
                  {{ t('batchDayList.calendarCellLate', { n: day.lateCount }) }}
                </span>
              </template>
            </template>
          </button>
        </template>
      </el-calendar>
    </section>

    <div v-else>
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
  import { ref, reactive, computed, watch } from 'vue'
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
  import { indexBatchDays, monthDateRange, summarizeBatchDays } from './batchDayPresentation'

  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleBatchDayResponse[]>([])
  const calendarRows = ref<ConsoleBatchDayResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const filters = reactive({
    calendarCode: 'DEFAULT',
    from: '' as string,
    to: '' as string,
  })
  const viewMode = ref<'calendar' | 'table'>('calendar')
  const calendarDate = ref(new Date())
  const viewModeOptions = computed(() => [
    { label: t('batchDayList.viewCalendar'), value: 'calendar' },
    { label: t('batchDayList.viewTable'), value: 'table' },
  ])
  const calendarIndex = computed(() => indexBatchDays(calendarRows.value))
  const calendarSummary = computed(() => summarizeBatchDays(calendarRows.value))
  const calendarMonthKey = computed(
    () => `${calendarDate.value.getFullYear()}-${calendarDate.value.getMonth()}`,
  )

  function calendarDay(day: string): ConsoleBatchDayResponse | undefined {
    return calendarIndex.value.get(day)
  }

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
      const monthRange = monthDateRange(calendarDate.value)
      const calendarMode = viewMode.value === 'calendar'
      const pr = await queryBatchDays({
        tenantId: tenant.tenantId,
        calendarCode: cal,
        from: calendarMode ? monthRange.from : filters.from || undefined,
        to: calendarMode ? monthRange.to : filters.to || undefined,
        pageNo: calendarMode ? 1 : page.value,
        pageSize: calendarMode ? 100 : pageSize.value,
      })
      const items = (pr.items ?? []) as ConsoleBatchDayResponse[]
      if (calendarMode) {
        calendarRows.value = items
      } else {
        rows.value = items
        total.value = pr.total ?? 0
      }
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
      calendarDate.value = new Date()
      await load()
    })
  }

  function goWindow(bizDate: string) {
    router.push({
      path: `/scheduler/batch-days/${encodeURIComponent(bizDate)}`,
      query: { calendarCode: filters.calendarCode.trim() || 'DEFAULT' },
    })
  }

  watch(viewMode, () => {
    loadError.value = null
    void load()
  })

  watch(calendarMonthKey, (_value, previous) => {
    if (previous !== undefined && viewMode.value === 'calendar') void load()
  })

  useTenantReload(load)
</script>

<style scoped>
  .batch-calendar {
    margin-top: var(--page-block-gap);
    overflow: hidden;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
  }

  .batch-calendar__summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: 1px solid var(--color-border-light);
  }

  .batch-calendar__metric {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-md);
    color: var(--color-text-secondary);
    border-right: 1px solid var(--color-border-light);
  }

  .batch-calendar__metric:last-child {
    border-right: 0;
  }

  .batch-calendar__metric strong {
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xl);
  }

  .batch-calendar__metric--danger strong {
    color: var(--el-color-danger);
  }

  .batch-calendar__metric--warning strong {
    color: var(--el-color-warning);
  }

  .batch-calendar__grid {
    --el-calendar-cell-width: auto;
  }

  .batch-calendar__empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin: var(--space-md) var(--space-md) 0;
    padding: var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
  }

  .batch-calendar__empty > div {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .batch-calendar__empty span {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .batch-calendar__grid :deep(.el-calendar__body) {
    padding: 0;
  }

  .batch-calendar__grid :deep(.el-calendar-table .el-calendar-day) {
    height: 7.5rem;
    padding: var(--space-xs);
  }

  .batch-calendar__day {
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    padding: var(--space-sm);
    color: var(--color-text-primary);
    text-align: left;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    background: transparent;
    cursor: pointer;
  }

  .batch-calendar__day:not(:disabled):hover,
  .batch-calendar__day:not(:disabled):focus-visible {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
    outline: none;
  }

  .batch-calendar__day:disabled {
    cursor: default;
  }

  .batch-calendar__day--outside {
    opacity: 0.35;
  }

  .batch-calendar__date {
    align-self: flex-end;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }

  .batch-calendar__counts,
  .batch-calendar__late {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-normal);
  }

  .batch-calendar__late {
    color: var(--el-color-warning);
  }

  @media (max-width: 1080px) {
    .batch-calendar__summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .batch-calendar__grid :deep(.el-calendar-table .el-calendar-day) {
      height: 6.5rem;
    }
  }

  @media (max-width: 640px) {
    .batch-calendar__empty {
      align-items: flex-start;
      flex-direction: column;
    }

    .batch-calendar__summary {
      grid-template-columns: 1fr;
    }

    .batch-calendar__metric {
      border-right: 0;
      border-bottom: 1px solid var(--color-border-light);
    }

    .batch-calendar__metric:last-child {
      border-bottom: 0;
    }

    .batch-calendar__grid {
      overflow-x: auto;
    }

    .batch-calendar__grid :deep(.el-calendar__header),
    .batch-calendar__grid :deep(.el-calendar__body) {
      min-width: 42rem;
    }
  }
</style>
