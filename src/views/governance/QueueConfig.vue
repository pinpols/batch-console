<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs governance-tabs">
        <el-tab-pane :label="t('queueConfig.tabQueues')" name="queues">
          <GovernanceFilterBar
            v-model:keyword="kwDraft"
            v-model:enabled="enabledDraft"
            :keyword-placeholder="keywordPlaceholder"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onTabSearch"
            @reset="onTabReset"
            @refresh="() => runRefresh(load)"
          />
          <el-table
            v-loading="loading"
            :data="pagedQueues.records"
            stripe
            border
            size="small"
            highlight-current-row
            :empty-text="t('common.noData')"
            class="console-table"
          >
            <el-table-column
              prop="queueCode"
              :label="t('queueConfig.colQueueCode')"
              min-width="150"
            />
            <el-table-column
              prop="queueName"
              :label="t('queueConfig.colQueueName')"
              min-width="160"
            />
            <el-table-column prop="queueType" :label="t('queueConfig.colQueueType')" width="120" />
            <el-table-column
              prop="fairShareGroup"
              :label="t('queueConfig.colFairShareGroup')"
              min-width="140"
            />
            <el-table-column
              prop="concurrentCap"
              :label="t('queueConfig.colConcurrentCap')"
              width="110"
            />
            <el-table-column
              prop="burstLimit"
              :label="t('queueConfig.colBurstLimit')"
              width="110"
            />
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="160" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `queue-${row.id}`"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleQueue(row)"
                />
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="pageQueues"
            :page-size="pageSize"
            :total="pagedQueues.total"
            @update:page="(p) => (pageQueues = p)"
            @update:page-size="onAnyPageSize"
          />
        </el-tab-pane>

        <el-tab-pane :label="t('queueConfig.tabWindows')" name="windows">
          <GovernanceFilterBar
            v-model:keyword="kwDraft"
            v-model:enabled="enabledDraft"
            :keyword-placeholder="keywordPlaceholder"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onTabSearch"
            @reset="onTabReset"
            @refresh="() => runRefresh(load)"
          />
          <el-table
            v-loading="loading"
            :data="pagedWindows.records"
            stripe
            border
            size="small"
            highlight-current-row
            :empty-text="t('common.noData')"
            class="console-table"
          >
            <el-table-column
              prop="windowCode"
              :label="t('queueConfig.colWindowCode')"
              min-width="150"
            />
            <el-table-column
              prop="windowName"
              :label="t('queueConfig.colWindowName')"
              min-width="160"
            />
            <el-table-column prop="startTime" :label="t('queueConfig.colStartTime')" width="110" />
            <el-table-column prop="endTime" :label="t('queueConfig.colEndTime')" width="110" />
            <el-table-column
              prop="crossDayPolicy"
              :label="t('queueConfig.colCrossDayPolicy')"
              min-width="120"
            />
            <el-table-column
              prop="outOfWindowAction"
              :label="t('queueConfig.colOutOfWindow')"
              min-width="140"
            />
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="160" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `window-${row.id}`"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleWindow(row)"
                />
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="pageWindows"
            :page-size="pageSize"
            :total="pagedWindows.total"
            @update:page="(p) => (pageWindows = p)"
            @update:page-size="onAnyPageSize"
          />
        </el-tab-pane>

        <el-tab-pane :label="t('queueConfig.tabCalendars')" name="calendars">
          <GovernanceFilterBar
            v-model:keyword="kwDraft"
            v-model:enabled="enabledDraft"
            :keyword-placeholder="keywordPlaceholder"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onTabSearch"
            @reset="onTabReset"
            @refresh="() => runRefresh(load)"
          />
          <el-table
            v-loading="loading"
            :data="pagedCalendars.records"
            stripe
            border
            size="small"
            highlight-current-row
            :empty-text="t('common.noData')"
            class="console-table"
          >
            <el-table-column
              prop="calendarCode"
              :label="t('queueConfig.colCalendarCode')"
              min-width="150"
            />
            <el-table-column
              prop="calendarName"
              :label="t('queueConfig.colCalendarName')"
              min-width="160"
            />
            <el-table-column
              prop="timezone"
              :label="t('queueConfig.colTimezone')"
              min-width="140"
            />
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="160" />
            <el-table-column :label="t('queueConfig.colHolidays')" min-width="128">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openHolidays(row)">
                    {{ t('queueConfig.viewHolidays') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="t('queueConfig.colEnabled')" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `calendar-${row.id}`"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleCalendar(row)"
                />
              </template>
            </el-table-column>
          </el-table>
          <TablePagerBar
            :page="pageCalendars"
            :page-size="pageSize"
            :total="pagedCalendars.total"
            @update:page="(p) => (pageCalendars = p)"
            @update:page-size="onAnyPageSize"
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <el-drawer
      v-model="holidayDrawerVisible"
      :title="holidayDrawerTitle"
      size="520px"
      destroy-on-close
    >
      <el-table
        v-loading="holidayLoading"
        :data="pagedHolidays.records"
        stripe
        border
        size="small"
        highlight-current-row
        class="console-table"
        empty-text="暂无数据"
      >
        <el-table-column
          prop="holidayDate"
          :label="t('queueConfig.holidayColDate')"
          min-width="130"
        />
        <el-table-column
          prop="holidayName"
          :label="t('queueConfig.holidayColName')"
          min-width="160"
        />
        <el-table-column
          prop="holidayType"
          :label="t('queueConfig.holidayColType')"
          min-width="120"
        />
        <el-table-column :label="t('queueConfig.holidayColEnabled')" width="90">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
      </el-table>
      <TablePagerBar
        :page="holidayPage"
        :page-size="holidayPageSize"
        :total="pagedHolidays.total"
        @update:page="(p) => (holidayPage = p)"
        @update:page-size="onHolidayPageSize"
      />
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import {
    governanceApi,
    type GovernanceBatchWindowRow,
    type GovernanceCalendarHolidayRow,
    type GovernanceCalendarRow,
    type GovernanceQueueRow,
  } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import GovernanceFilterBar from './components/GovernanceFilterBar.vue'

  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  const loading = ref(false)
  const holidayLoading = ref(false)
  const togglingKey = ref('')
  const activeTab = ref<'queues' | 'windows' | 'calendars'>('queues')
  const kwDraft = ref('')
  const enabledDraft = ref<boolean | undefined>(undefined)
  const kwApplied = ref('')
  const enabledApplied = ref<boolean | undefined>(undefined)
  const queues = ref<GovernanceQueueRow[]>([])
  const windows = ref<GovernanceBatchWindowRow[]>([])
  const calendars = ref<GovernanceCalendarRow[]>([])
  const holidays = ref<GovernanceCalendarHolidayRow[]>([])
  const holidayDrawerVisible = ref(false)
  const holidayDrawerTitle = ref(t('queueConfig.holidayDrawerTitle'))
  const pageSize = ref(20)
  const pageQueues = ref(1)
  const pageWindows = ref(1)
  const pageCalendars = ref(1)
  const holidayPage = ref(1)
  const holidayPageSize = ref(20)

  const keywordPlaceholder = computed(() => {
    if (activeTab.value === 'windows') return t('queueConfig.keywordWindows')
    if (activeTab.value === 'calendars') return t('queueConfig.keywordCalendars')
    return t('queueConfig.keywordQueues')
  })

  function matchEnabled(enabled: boolean) {
    return enabledApplied.value === undefined ? true : enabled === enabledApplied.value
  }

  function resetListPages() {
    pageQueues.value = 1
    pageWindows.value = 1
    pageCalendars.value = 1
  }

  function onTabSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      enabledApplied.value = enabledDraft.value
      resetListPages()
    })
  }

  function onTabReset() {
    return runReset(() => {
      kwDraft.value = ''
      enabledDraft.value = undefined
      kwApplied.value = ''
      enabledApplied.value = undefined
      resetListPages()
    })
  }

  function onAnyPageSize(s: number) {
    pageSize.value = s
    resetListPages()
  }

  function onHolidayPageSize(s: number) {
    holidayPageSize.value = s
    holidayPage.value = 1
  }

  const filteredQueues = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    return queues.value.filter(
      (row) =>
        matchEnabled(row.enabled) &&
        (!k || `${row.queueCode} ${row.queueName} ${row.queueType}`.toLowerCase().includes(k)),
    )
  })

  const filteredWindows = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    return windows.value.filter(
      (row) =>
        matchEnabled(row.enabled) &&
        (!k ||
          `${row.windowCode} ${row.windowName} ${row.crossDayPolicy}`.toLowerCase().includes(k)),
    )
  })

  const filteredCalendars = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    return calendars.value.filter(
      (row) =>
        matchEnabled(row.enabled) &&
        (!k || `${row.calendarCode} ${row.calendarName} ${row.timezone}`.toLowerCase().includes(k)),
    )
  })

  const pagedQueues = computed(() =>
    toPageResult(filteredQueues.value, pageQueues.value, pageSize.value),
  )
  const pagedWindows = computed(() =>
    toPageResult(filteredWindows.value, pageWindows.value, pageSize.value),
  )
  const pagedCalendars = computed(() =>
    toPageResult(filteredCalendars.value, pageCalendars.value, pageSize.value),
  )
  const pagedHolidays = computed(() =>
    toPageResult(holidays.value, holidayPage.value, holidayPageSize.value),
  )

  function clampPage(pageRef: { value: number }, total: number, size: number) {
    const max = Math.max(1, Math.ceil(total / size) || 1)
    if (pageRef.value > max) pageRef.value = max
  }

  watch([filteredQueues, pageSize], () =>
    clampPage(pageQueues, filteredQueues.value.length, pageSize.value),
  )
  watch([filteredWindows, pageSize], () =>
    clampPage(pageWindows, filteredWindows.value.length, pageSize.value),
  )
  watch([filteredCalendars, pageSize], () =>
    clampPage(pageCalendars, filteredCalendars.value.length, pageSize.value),
  )
  watch([holidays, holidayPageSize], () =>
    clampPage(holidayPage, holidays.value.length, holidayPageSize.value),
  )

  async function load() {
    loading.value = true
    try {
      const [queueRows, windowRows, calendarRows] = await Promise.all([
        governanceApi.listQueues(tenant.tenantId),
        governanceApi.listBatchWindows(tenant.tenantId),
        governanceApi.listCalendars(tenant.tenantId),
      ])
      queues.value = queueRows
      windows.value = windowRows
      calendars.value = calendarRows
    } catch {
      queues.value = []
      windows.value = []
      calendars.value = []
    } finally {
      loading.value = false
    }
  }

  /** 三种 toggle 的共同骨架:确认 → 调 API → 回写 row.enabled。 */
  async function confirmAndToggle(
    label: string,
    rowId: number | undefined,
    enabledNext: boolean,
    togglingId: string,
    apiCall: () => Promise<unknown>,
    onSuccess: () => void,
  ) {
    if (!rowId) return
    try {
      const action = enabledNext ? t('queueConfig.enable') : t('queueConfig.disable')
      await ElMessageBox.confirm(
        t('queueConfig.toggleConfirmText', { label, action }),
        t('queueConfig.toggleConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    togglingKey.value = togglingId
    try {
      await apiCall()
      onSuccess()
      const action = enabledNext ? t('queueConfig.enable') : t('queueConfig.disable')
      ElMessage.success(t('queueConfig.toggleSuccess', { label, action }))
    } finally {
      togglingKey.value = ''
    }
  }

  function toggleQueue(row: GovernanceQueueRow) {
    const next = !row.enabled
    return confirmAndToggle(
      t('queueConfig.queueLabel', { code: row.queueCode }),
      row.id,
      next,
      `queue-${row.id}`,
      () => governanceApi.toggleQueue(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleWindow(row: GovernanceBatchWindowRow) {
    const next = !row.enabled
    return confirmAndToggle(
      t('queueConfig.windowLabel', { code: row.windowCode }),
      row.id,
      next,
      `window-${row.id}`,
      () => governanceApi.toggleBatchWindow(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleCalendar(row: GovernanceCalendarRow) {
    const next = !row.enabled
    return confirmAndToggle(
      t('queueConfig.calendarLabel', { code: row.calendarCode }),
      row.id,
      next,
      `calendar-${row.id}`,
      () => governanceApi.toggleCalendar(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  async function openHolidays(row: GovernanceCalendarRow) {
    holidayPage.value = 1
    holidayDrawerVisible.value = true
    holidayDrawerTitle.value = t('queueConfig.holidayDrawerTitleWithCode', {
      code: row.calendarCode,
    })
    holidayLoading.value = true
    try {
      holidays.value = row.id
        ? await governanceApi.listCalendarHolidays(row.id, tenant.tenantId)
        : []
    } catch {
      holidays.value = []
    } finally {
      holidayLoading.value = false
    }
  }

  watch(activeTab, () => {
    kwDraft.value = ''
    enabledDraft.value = undefined
    kwApplied.value = ''
    enabledApplied.value = undefined
    resetListPages()
  })

  useTenantReload(load)
</script>

<style scoped>
  .governance-tabs :deep(.el-tabs__content) {
    padding-top: 10px;
    overflow: visible;
  }
</style>
