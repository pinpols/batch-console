<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canReplay" @click="router.push('/ops/batch-day-replay')">
          {{ t('batchDayList.replayAction') }}
        </el-button>
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

    <section
      v-if="viewMode === 'calendar'"
      :key="locale"
      class="batch-calendar"
      v-loading="loading"
    >
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

      <section class="batch-calendar__grid" :aria-label="t('batchDayList.calendarSummary')">
        <header class="batch-calendar__toolbar">
          <div class="batch-calendar__month-group">
            <h2 class="batch-calendar__month">{{ calendarMonthLabel }}</h2>
            <div
              v-if="!loading && !loadError && calendarSummary.days === 0"
              class="batch-calendar__empty-hint"
              role="status"
            >
              <el-tooltip :content="t('batchDayList.emptyMonthDescription')" placement="bottom">
                <span class="batch-calendar__empty-message" tabindex="0">
                  <el-icon aria-hidden="true"><Info /></el-icon>
                  {{ t('batchDayList.emptyMonthTitle') }}
                </span>
              </el-tooltip>
              <el-button text type="primary" size="small" @click="viewMode = 'table'">
                {{ t('batchDayList.viewTable') }}
              </el-button>
            </div>
          </div>
          <div class="batch-calendar__navigation">
            <el-button
              circle
              plain
              :icon="ChevronLeft"
              :aria-label="t('batchDayList.previousMonth')"
              :title="t('batchDayList.previousMonth')"
              @click="changeMonth(-1)"
            />
            <el-button size="small" plain @click="goToToday">
              {{ t('batchDayList.today') }}
            </el-button>
            <el-button
              circle
              plain
              :icon="ChevronRight"
              :aria-label="t('batchDayList.nextMonth')"
              :title="t('batchDayList.nextMonth')"
              @click="changeMonth(1)"
            />
          </div>
        </header>
        <div class="batch-calendar__matrix">
          <div class="batch-calendar__weekdays">
            <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
          </div>
          <div
            v-for="week in calendarWeeks"
            :key="calendarDateKey(week[0])"
            class="batch-calendar__week"
          >
            <button
              v-for="date in week"
              :key="calendarDateKey(date)"
              type="button"
              class="batch-calendar__day"
              :class="{
                'batch-calendar__day--outside': !isCurrentMonth(date),
                'batch-calendar__day--today': isToday(date),
                'batch-calendar__day--has-data': Boolean(calendarDay(calendarDateKey(date))),
              }"
              :disabled="!calendarDay(calendarDateKey(date))"
              :aria-label="calendarAccessibleLabel(date)"
              @click.stop="calendarDay(calendarDateKey(date)) && goWindow(calendarDateKey(date))"
            >
              <span class="batch-calendar__date">{{ date.getDate() }}</span>
              <template
                v-for="day in [calendarDay(calendarDateKey(date))]"
                :key="calendarDateKey(date)"
              >
                <template v-if="day">
                  <StatusTag :value="String(day.dayStatus ?? '')" category="batchDay" />
                  <span class="batch-calendar__counts">
                    <span
                      class="batch-calendar__count batch-calendar__count--success"
                      :title="t('batchDayList.calendarCellSuccess')"
                    >
                      <el-icon :size="12" aria-hidden="true"><Check /></el-icon>
                      {{ day.successJobCount ?? 0 }}
                    </span>
                    <span
                      class="batch-calendar__count batch-calendar__count--failed"
                      :title="t('batchDayList.calendarCellFailed')"
                    >
                      <el-icon :size="12" aria-hidden="true"><X /></el-icon>
                      {{ day.failedJobCount ?? 0 }}
                    </span>
                    <span
                      class="batch-calendar__count batch-calendar__count--running"
                      :title="t('batchDayList.calendarCellRunning')"
                    >
                      <el-icon :size="12" aria-hidden="true"><Clock3 /></el-icon>
                      {{ day.inFlightJobCount ?? 0 }}
                    </span>
                  </span>
                  <span v-if="day.lateCount" class="batch-calendar__late">
                    {{ t('batchDayList.calendarCellLate', { n: day.lateCount }) }}
                  </span>
                </template>
              </template>
            </button>
          </div>
        </div>
      </section>
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
              <el-button
                size="small"
                plain
                type="primary"
                :icon="CalendarDays"
                @click="goWindow(row.bizDate)"
              >
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
  import { CalendarDays } from '@lucide/vue'
  import { ref, reactive, computed, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { usePermission } from '@/composables/usePermission'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Check, ChevronLeft, ChevronRight, Clock3, Info, X } from '@lucide/vue'

  const { t, locale } = useI18n({ useScope: 'global' })
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
  import { businessCalendarDate } from '@/utils/datetime'
  import type { ConsoleBatchDayResponse } from '@/types/console-api'
  import {
    indexBatchDays,
    monthDateRange,
    monthGridDates,
    summarizeBatchDays,
    toLocalDateKey,
  } from './batchDayPresentation'

  const router = useRouter()
  const { canAccess } = usePermission()
  const canReplay = computed(() => canAccess('OPERATOR'))
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
  const calendarDate = ref(businessCalendarDate())
  const viewModeOptions = computed(() => [
    { label: t('batchDayList.viewCalendar'), value: 'calendar' },
    { label: t('batchDayList.viewTable'), value: 'table' },
  ])
  const calendarIndex = computed(() => indexBatchDays(calendarRows.value))
  const calendarSummary = computed(() => summarizeBatchDays(calendarRows.value))
  const calendarMonthKey = computed(
    () => `${calendarDate.value.getFullYear()}-${calendarDate.value.getMonth()}`,
  )
  const calendarWeeks = computed(() => {
    const dates = monthGridDates(calendarDate.value)
    return Array.from({ length: dates.length / 7 }, (_, index) =>
      dates.slice(index * 7, index * 7 + 7),
    )
  })
  const calendarMonthLabel = computed(() =>
    new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
      calendarDate.value,
    ),
  )
  const weekdayLabels = computed(() => {
    const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, index + 1)))
  })

  function calendarDateKey(date: Date): string {
    return toLocalDateKey(date)
  }

  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === calendarDate.value.getMonth()
  }

  function isToday(date: Date): boolean {
    return calendarDateKey(date) === calendarDateKey(businessCalendarDate())
  }

  function calendarAccessibleLabel(date: Date): string {
    const day = calendarDay(calendarDateKey(date))
    const dateLabel = new Intl.DateTimeFormat(locale.value, { dateStyle: 'full' }).format(date)
    if (!day) return dateLabel
    return `${dateLabel}, ${t('batchDayList.calendarCellCounts', {
      success: day.successJobCount ?? 0,
      failed: day.failedJobCount ?? 0,
      running: day.inFlightJobCount ?? 0,
    })}${day.lateCount ? `, ${t('batchDayList.calendarCellLate', { n: day.lateCount })}` : ''}`
  }

  function changeMonth(offset: number) {
    const next = new Date(calendarDate.value)
    next.setDate(1)
    next.setMonth(next.getMonth() + offset)
    calendarDate.value = next
  }

  function goToToday() {
    calendarDate.value = businessCalendarDate()
  }

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
      calendarDate.value = businessCalendarDate()
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
    padding: 0 var(--space-md) var(--space-md);
  }

  .batch-calendar__month-group,
  .batch-calendar__empty-hint,
  .batch-calendar__empty-message {
    display: flex;
    align-items: center;
  }

  .batch-calendar__month-group {
    min-width: 0;
    flex-wrap: wrap;
    gap: var(--space-sm) var(--space-md);
  }

  .batch-calendar__empty-hint {
    min-width: 0;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .batch-calendar__empty-message {
    gap: var(--space-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    cursor: help;
  }

  .batch-calendar__empty-message .el-icon {
    color: var(--color-text-tertiary);
  }

  .batch-calendar__toolbar {
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .batch-calendar__month {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .batch-calendar__navigation {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .batch-calendar__matrix {
    border-left: 1px solid var(--color-border-light);
  }

  .batch-calendar__weekdays,
  .batch-calendar__week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .batch-calendar__weekdays {
    min-height: 2.25rem;
    align-items: center;
    border-top: 1px solid var(--color-border-light);
    border-bottom: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-align: center;
  }

  .batch-calendar__day {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 5.25rem;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 6px 8px;
    color: var(--color-text-primary);
    text-align: left;
    border: 0;
    border-right: 1px solid var(--color-border-light);
    border-bottom: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
    cursor: pointer;
  }

  .batch-calendar__day:not(:disabled):hover,
  .batch-calendar__day:not(:disabled):focus-visible {
    background: var(--color-bg-subtle);
    box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
    outline: 0;
  }

  .batch-calendar__day:disabled {
    cursor: default;
  }

  .batch-calendar__day--outside {
    background: var(--color-bg-subtle);
  }

  .batch-calendar__day--outside {
    color: var(--color-text-tertiary);
  }

  .batch-calendar__day--today .batch-calendar__date {
    display: inline-flex;
    min-width: 1.5rem;
    height: 1.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--el-color-primary);
    color: var(--el-color-white);
  }

  .batch-calendar__day--has-data {
    background: color-mix(in srgb, var(--el-color-primary) 5%, var(--color-bg-card));
  }

  .batch-calendar__date {
    align-self: flex-start;
    color: inherit;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .batch-calendar__counts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px 8px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    line-height: 1.3;
  }

  .batch-calendar__count {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .batch-calendar__count--success {
    color: var(--el-color-success);
  }

  .batch-calendar__count--failed {
    color: var(--el-color-danger);
  }

  .batch-calendar__count--running {
    color: var(--el-color-primary);
  }

  .batch-calendar__late {
    color: var(--el-color-warning);
    font-size: var(--font-size-xs);
  }

  @media (max-width: 1080px) {
    .batch-calendar__summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .batch-calendar__day {
      min-height: 4.75rem;
      padding: 5px;
    }

    .batch-calendar__counts {
      gap: 2px 5px;
    }
  }

  @media (max-width: 640px) {
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

    .batch-calendar__toolbar,
    .batch-calendar__weekdays,
    .batch-calendar__week {
      min-width: 38rem;
    }
  }
</style>
