<template>
  <PageContainer>
    <PageHeader
      title="队列与窗口"
      description="对接治理接口:`queues`、`batch-windows`、`calendars`;列表由客户端拉全量后筛选与分页(与 OpenAPI 分页字段无关)。"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs governance-tabs">
        <el-tab-pane label="队列" name="queues">
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
            empty-text="暂无数据"
            class="console-table"
          >
            <el-table-column prop="queueCode" label="队列编码" min-width="150" />
            <el-table-column prop="queueName" label="名称" min-width="160" />
            <el-table-column prop="queueType" label="类型" width="120" />
            <el-table-column prop="fairShareGroup" label="公平组" min-width="140" />
            <el-table-column prop="concurrentCap" label="并发上限" width="110" />
            <el-table-column prop="burstLimit" label="突发上限" width="110" />
            <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
            <el-table-column label="启用" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `queue-${row.id}`"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
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

        <el-tab-pane label="批次窗口" name="windows">
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
            empty-text="暂无数据"
            class="console-table"
          >
            <el-table-column prop="windowCode" label="窗口编码" min-width="150" />
            <el-table-column prop="windowName" label="名称" min-width="160" />
            <el-table-column prop="startTime" label="开始时间" width="110" />
            <el-table-column prop="endTime" label="结束时间" width="110" />
            <el-table-column prop="crossDayPolicy" label="跨日策略" min-width="120" />
            <el-table-column prop="outOfWindowAction" label="窗口外动作" min-width="140" />
            <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
            <el-table-column label="启用" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `window-${row.id}`"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
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

        <el-tab-pane label="日历" name="calendars">
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
            empty-text="暂无数据"
            class="console-table"
          >
            <el-table-column prop="calendarCode" label="日历编码" min-width="150" />
            <el-table-column prop="calendarName" label="名称" min-width="160" />
            <el-table-column prop="timezone" label="时区" min-width="140" />
            <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
            <el-table-column label="节假日" min-width="128">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openHolidays(row)">
                    查看节假日
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="110" fixed="right">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `calendar-${row.id}`"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
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
        <el-table-column prop="holidayDate" label="日期" min-width="130" />
        <el-table-column prop="holidayName" label="名称" min-width="160" />
        <el-table-column prop="holidayType" label="类型" min-width="120" />
        <el-table-column label="启用" width="90">
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
  import { ElMessage, ElMessageBox } from 'element-plus'
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
  const holidayDrawerTitle = ref('节假日')
  const pageSize = ref(20)
  const pageQueues = ref(1)
  const pageWindows = ref(1)
  const pageCalendars = ref(1)
  const holidayPage = ref(1)
  const holidayPageSize = ref(20)

  const keywordPlaceholder = computed(() => {
    if (activeTab.value === 'windows') return '搜索 windowCode / name'
    if (activeTab.value === 'calendars') return '搜索 calendarCode / name'
    return '搜索 queueCode / name'
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
      await ElMessageBox.confirm(
        `确认将 ${label} ${enabledNext ? '启用' : '停用'}吗?`,
        '状态切换确认',
        {
          type: 'warning',
        },
      )
    } catch {
      return
    }
    togglingKey.value = togglingId
    try {
      await apiCall()
      onSuccess()
      ElMessage.success(`${label} 已${enabledNext ? '启用' : '停用'}`)
    } finally {
      togglingKey.value = ''
    }
  }

  function toggleQueue(row: GovernanceQueueRow) {
    const next = !row.enabled
    return confirmAndToggle(
      `队列 ${row.queueCode}`,
      row.id,
      next,
      `queue-${row.id}`,
      () => governanceApi.toggleQueue(row.id, tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleWindow(row: GovernanceBatchWindowRow) {
    const next = !row.enabled
    return confirmAndToggle(
      `窗口 ${row.windowCode}`,
      row.id,
      next,
      `window-${row.id}`,
      () => governanceApi.toggleBatchWindow(row.id, tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleCalendar(row: GovernanceCalendarRow) {
    const next = !row.enabled
    return confirmAndToggle(
      `日历 ${row.calendarCode}`,
      row.id,
      next,
      `calendar-${row.id}`,
      () => governanceApi.toggleCalendar(row.id, tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  async function openHolidays(row: GovernanceCalendarRow) {
    holidayPage.value = 1
    holidayDrawerVisible.value = true
    holidayDrawerTitle.value = `${row.calendarCode} 节假日`
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
