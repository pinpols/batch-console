<template>
  <section class="holiday-month" :aria-label="t('queueConfig.holidayMonthTitle')">
    <header class="holiday-month__header">
      <h3>{{ monthLabel }}</h3>
      <div class="holiday-month__actions">
        <el-button size="small" @click="changeMonth(-1)">{{
          t('queueConfig.holidayMonthPrevious')
        }}</el-button>
        <el-button size="small" @click="goCurrentMonth">{{
          t('queueConfig.holidayMonthCurrent')
        }}</el-button>
        <el-button size="small" @click="changeMonth(1)">{{
          t('queueConfig.holidayMonthNext')
        }}</el-button>
      </div>
    </header>
    <p>{{ t('queueConfig.holidayMonthHint') }}</p>
    <div class="holiday-month__grid">
      <span v-for="day in weekdayLabels" :key="day" class="holiday-month__weekday">{{ day }}</span>
      <template v-for="date in monthDays" :key="toLocalDateKey(date)">
        <button
          v-if="date.getMonth() === month.getMonth()"
          type="button"
          class="holiday-month__day"
          :class="{
            'is-selected': selectedDate === toLocalDateKey(date),
            'has-records': recordsByDate.has(toLocalDateKey(date)),
          }"
          :data-date="toLocalDateKey(date)"
          :aria-pressed="selectedDate === toLocalDateKey(date)"
          :aria-label="
            t('queueConfig.holidayMonthDayLabel', {
              date: toLocalDateKey(date),
              count: recordsByDate.get(toLocalDateKey(date))?.length ?? 0,
            })
          "
          @click="selectedDate = toLocalDateKey(date)"
        >
          <span>{{ date.getDate() }}</span>
          <span
            v-if="recordsByDate.has(toLocalDateKey(date))"
            aria-hidden="true"
            class="holiday-month__dot"
          />
        </button>
        <span v-else class="holiday-month__outside" aria-hidden="true">{{ date.getDate() }}</span>
      </template>
    </div>
    <div v-if="selectedDate" class="holiday-month__detail" role="status">
      <strong>{{ selectedDate }}</strong>
      <ul v-if="selectedRecords.length">
        <li v-for="(record, index) in selectedRecords" :key="`${record.id}:${index}`">
          {{ record.holidayName || t('queueConfig.holidayMonthUnnamed') }} ·
          {{ dayType(record.holidayType) }}
        </li>
      </ul>
      <p v-else>{{ t('queueConfig.holidayMonthUnknown') }}</p>
    </div>
  </section>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { GovernanceCalendarHolidayRow } from '@/api/governance'
  import { businessCalendarDate } from '@/utils/datetime'
  import { monthGridDates, toLocalDateKey } from '@/views/scheduler/batchDayPresentation'

  const props = defineProps<{ records: GovernanceCalendarHolidayRow[] }>()
  const { t, te, locale } = useI18n({ useScope: 'global' })
  const month = ref(businessCalendarDate())
  const selectedDate = ref('')
  const monthDays = computed(() => monthGridDates(month.value))
  const monthLabel = computed(() =>
    new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(month.value),
  )
  const weekdayLabels = computed(() => {
    const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, index + 1)))
  })
  const recordsByDate = computed(() => {
    const result = new Map<string, GovernanceCalendarHolidayRow[]>()
    for (const record of props.records) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.holidayDate)) continue
      const rows = result.get(record.holidayDate) ?? []
      rows.push(record)
      result.set(record.holidayDate, rows)
    }
    return result
  })
  const selectedRecords = computed(() => recordsByDate.value.get(selectedDate.value) ?? [])
  function dayType(value: string) {
    if (!value) return '—'
    const key = `enum.dayType.${value}`
    return te(key) ? t(key) : value
  }
  function changeMonth(offset: number) {
    month.value = new Date(month.value.getFullYear(), month.value.getMonth() + offset, 1, 12)
    selectedDate.value = ''
  }
  function goCurrentMonth() {
    month.value = businessCalendarDate()
    selectedDate.value = ''
  }
</script>
<style scoped>
  .holiday-month {
    margin: var(--space-md) 0;
  }
  .holiday-month__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .holiday-month__header h3 {
    margin: 0;
    font-size: 14px;
  }
  .holiday-month__actions {
    display: flex;
    gap: var(--space-xs);
  }
  .holiday-month__actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }
  .holiday-month p {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .holiday-month__grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }
  .holiday-month__weekday,
  .holiday-month__outside {
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    padding: 6px 0;
  }
  .holiday-month__day {
    position: relative;
    min-width: 0;
    min-height: 36px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-control);
    background: var(--color-bg-card);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .holiday-month__day.is-selected {
    border-color: var(--color-primary);
    background: var(--color-bg-info);
  }
  .holiday-month__day:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }
  .holiday-month__dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-primary);
    margin-left: 3px;
    vertical-align: middle;
  }
  .holiday-month__detail {
    padding: var(--space-sm);
    background: var(--color-bg-subtle);
    margin-top: var(--space-sm);
    overflow-wrap: anywhere;
  }
  .holiday-month__detail p {
    margin-bottom: 0;
  }
  .holiday-month__detail ul {
    margin: var(--space-xs) 0 0;
    padding-left: 20px;
  }
</style>
