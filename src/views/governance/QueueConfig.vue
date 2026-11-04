<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="onCreateClick">
          {{ activeCreateLabel }}
        </el-button>
      </template>
    </PageHeader>

    <div class="governance-workspace">
      <el-segmented
        class="pill-segmented"
        :model-value="governancePath"
        :options="governanceOptions"
        :aria-label="t('queueConfig.workspaceLabel')"
        @change="onWorkspaceChange"
      />
    </div>

    <el-alert
      v-if="loadError"
      class="governance-load-error"
      type="error"
      show-icon
      :closable="false"
      :title="t('queueConfig.loadError')"
    >
      <template #default>
        <el-button link type="primary" @click="loadActiveTab(true)">
          {{ t('common.retry') }}
        </el-button>
      </template>
    </el-alert>

    <!-- 还原设计:tabs 与内容直铺底色,无外层卡片壳 -->
    <div>
      <el-tabs
        v-model="activeTab"
        class="pill-tabs governance-tabs"
        :class="{ 'single-mode': mode !== 'all' }"
      >
        <!-- el-tab-pane 不能用 v-if(EP 2.9 unmount bug,panes.indexOf undefined);用 v-show 避免崩溃 -->
        <el-tab-pane v-show="showQueuesTab" :label="t('queueConfig.tabQueues')" name="queues">
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
            <el-table-column prop="queueCode" :label="t('queueConfig.colQueueCode')" width="220">
              <template #default="{ row }"><CopyableText :text="row.queueCode" /></template>
            </el-table-column>
            <el-table-column
              prop="queueName"
              :label="t('queueConfig.colQueueName')"
              min-width="240"
            >
              <template #default="{ row }">
                <CopyableText v-if="row.queueName" :text="row.queueName" />
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="queueType" :label="t('queueConfig.colQueueType')" width="120">
              <template #default="{ row }">
                {{ row.queueType ? t(`enum.queueType.${row.queueType}`, row.queueType) : '—' }}
              </template>
            </el-table-column>
            <el-table-column
              prop="fairShareGroup"
              :label="t('queueConfig.colFairShareGroup')"
              width="180"
            >
              <template #default="{ row }">
                <CopyableText v-if="row.fairShareGroup" :text="row.fairShareGroup" />
                <span v-else>—</span>
              </template>
            </el-table-column>
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
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `queue-${row.id}`"
                  :disabled="!canMutateConfig"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleQueue(row as GovernanceQueueRow)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="canMutateConfig"
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.queueCode"
                  @click="openQueueEdit(row as GovernanceQueueRow)"
                >
                  {{ t('common.edit') }}
                </el-button>
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

        <el-tab-pane v-show="showWindowsTab" :label="t('queueConfig.tabWindows')" name="windows">
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
            <el-table-column prop="windowCode" :label="t('queueConfig.colWindowCode')" width="220">
              <template #default="{ row }"><CopyableText :text="row.windowCode" /></template>
            </el-table-column>
            <el-table-column
              prop="windowName"
              :label="t('queueConfig.colWindowName')"
              min-width="240"
            >
              <template #default="{ row }">
                <CopyableText v-if="row.windowName" :text="row.windowName" />
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="startTime" :label="t('queueConfig.colStartTime')" width="110" />
            <el-table-column prop="endTime" :label="t('queueConfig.colEndTime')" width="110" />
            <el-table-column
              prop="endStrategy"
              :label="t('queueConfig.fieldEndStrategy')"
              width="150"
            >
              <template #default="{ row }">
                {{
                  row.endStrategy ? t(`enum.endStrategy.${row.endStrategy}`, row.endStrategy) : '—'
                }}
              </template>
            </el-table-column>
            <el-table-column
              prop="outOfWindowAction"
              :label="t('queueConfig.colOutOfWindow')"
              width="160"
            >
              <template #default="{ row }">
                {{
                  row.outOfWindowAction
                    ? t(`enum.outOfWindowAction.${row.outOfWindowAction}`, row.outOfWindowAction)
                    : '—'
                }}
              </template>
            </el-table-column>
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `window-${row.id}`"
                  :disabled="!canMutateConfig"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleWindow(row as GovernanceBatchWindowRow)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="canMutateConfig"
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.windowCode"
                  @click="openWindowEdit(row as GovernanceBatchWindowRow)"
                >
                  {{ t('common.edit') }}
                </el-button>
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

        <el-tab-pane
          v-show="showCalendarsTab"
          :label="t('queueConfig.tabCalendars')"
          name="calendars"
        >
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
              width="220"
            >
              <template #default="{ row }"><CopyableText :text="row.calendarCode" /></template>
            </el-table-column>
            <el-table-column
              prop="calendarName"
              :label="t('queueConfig.colCalendarName')"
              min-width="240"
            >
              <template #default="{ row }">
                <CopyableText v-if="row.calendarName" :text="row.calendarName" />
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="timezone" :label="t('queueConfig.colTimezone')" width="160">
              <template #default="{ row }">
                <CopyableText v-if="row.timezone" :text="row.timezone" />
                <span v-else>—</span>
              </template>
            </el-table-column>
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colHolidays')" min-width="128">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    :icon="CalendarDays"
                    @click="openHolidays(row as GovernanceCalendarRow)"
                  >
                    {{ t('queueConfig.viewHolidays') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="t('queueConfig.colEnabled')" width="110">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :loading="togglingKey === `calendar-${row.id}`"
                  :disabled="!canMutateConfig"
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleCalendar(row as GovernanceCalendarRow)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="canMutateConfig"
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.calendarCode"
                  @click="openCalendarEdit(row as GovernanceCalendarRow)"
                >
                  {{ t('common.edit') }}
                </el-button>
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
    </div>

    <el-drawer
      :append-to-body="true"
      v-model="holidayDrawerVisible"
      :title="holidayDrawerTitle"
      size="480px"
      destroy-on-close
    >
      <div class="config-toolbar">
        <el-button
          v-if="canMutateConfig"
          type="primary"
          :icon="Plus"
          :disabled="!currentCalendarId"
          @click="openHolidayCreate"
        >
          {{ t('common.create') }}
        </el-button>
      </div>
      <el-alert
        v-if="holidayError"
        type="error"
        :closable="false"
        show-icon
        :title="t('queueConfig.holidayLoadError')"
      >
        <el-button size="small" @click="reloadCurrentHolidays">{{ t('common.retry') }}</el-button>
      </el-alert>
      <p v-else-if="holidayLoading">{{ t('common.loading') }}</p>
      <HolidayMonthView v-else-if="holidayLoaded" :records="holidays" />
      <el-table
        v-loading="holidayLoading"
        :data="pagedHolidays.records"
        stripe
        border
        size="small"
        highlight-current-row
        class="console-table"
        :empty-text="holidayError ? t('queueConfig.holidayLoadError') : t('common.noData')"
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
        >
          <template #default="{ row }">
            <CopyableText v-if="row.holidayName" :text="row.holidayName" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="holidayType"
          :label="t('queueConfig.holidayColType')"
          min-width="120"
        >
          <template #default="{ row }">
            {{ row.holidayType ? t(`enum.dayType.${row.holidayType}`, row.holidayType) : '—' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canMutateConfig"
          :label="t('fileTemplateList.colActions')"
          width="170"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                type="primary"
                plain
                size="small"
                :icon="Edit"
                @click="openHolidayEdit(row as GovernanceCalendarHolidayRow)"
              >
                {{ t('common.edit') }}
              </el-button>
              <el-button
                type="danger"
                plain
                size="small"
                :icon="Delete"
                @click="deleteHoliday(row as GovernanceCalendarHolidayRow)"
              >
                {{ t('common.delete') }}
              </el-button>
            </div>
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

    <GovernanceQueueEditor
      v-model="queueDialogVisible"
      :queue-form="queueForm"
      :queue-editing-id="queueEditingId"
      :errors="queueValidationErrors"
      :saving="saving"
      @save="saveQueue"
    />

    <GovernanceWindowEditor
      v-model="windowDialogVisible"
      :window-form="windowForm"
      :window-editing-id="windowEditingId"
      :saving="saving"
      @save="saveWindow"
    />

    <GovernanceCalendarEditor
      v-model="calendarDialogVisible"
      :calendar-form="calendarForm"
      :calendar-editing-id="calendarEditingId"
      :saving="saving"
      @save="saveCalendar"
    />

    <FormDrawer
      v-model:visible="holidayDialogVisible"
      :title="
        holidayEditingId == null
          ? t('queueConfig.holidayCreateTitle')
          : t('queueConfig.holidayEditTitle')
      "
      size="sm"
      destroy-on-close
      :saving="saving"
      @submit="saveHoliday"
    >
      <el-form :model="holidayForm" label-width="120px">
        <el-form-item :label="t('queueConfig.fieldBizDate')" required
          ><el-date-picker
            v-model="holidayForm.bizDate"
            class="query-w-full"
            type="date"
            value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldDayType')" required
          ><MetaSelect v-model="holidayForm.dayType" enum-key="dayType" class="query-w-full"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldHolidayName')"
          ><el-input v-model="holidayForm.holidayName" maxlength="128"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldDescription')"
          ><el-input
            v-model="holidayForm.description"
            type="textarea"
            maxlength="512"
            show-word-limit
        /></el-form-item>
      </el-form>
    </FormDrawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import FormDrawer from '@/components/common/FormDrawer.vue'
  import {
    filterGovernanceQueues,
    filterGovernanceWindows,
    filterGovernanceCalendars,
  } from './governanceListFilters'
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { CalendarDays, Trash2 as Delete, Pencil as Edit, Plus } from '@lucide/vue'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import {
    governanceApi,
    type GovernanceBatchWindowSavePayload,
    type GovernanceBatchWindowRow,
    type GovernanceCalendarHolidayRow,
    type GovernanceCalendarHolidaySavePayload,
    type GovernanceCalendarRow,
    type GovernanceCalendarSavePayload,
    type GovernanceQueueRow,
    type GovernanceQueueSavePayload,
  } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import PageContainer from '@/components/common/PageContainer.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import GovernanceQueueEditor from './GovernanceQueueEditor.vue'
  import GovernanceCalendarEditor from './GovernanceCalendarEditor.vue'
  import { usePermission } from '@/composables/usePermission'
  import PageHeader from '@/components/common/PageHeader.vue'
  // 三类治理资源的写接口均为 ROLE_ADMIN;租户管理员仅可读取业务日历。
  const { canAccess, canWriteSystem: canMutateConfig } = usePermission()
  // 计数字段按后端 int32 上限约束，避免超界值在 Jackson 反序列化阶段返回 400。
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import GovernanceFilterBar from './components/GovernanceFilterBar.vue'
  import HolidayMonthView from './HolidayMonthView.vue'
  import GovernanceWindowEditor from './GovernanceWindowEditor.vue'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { clampPage, optionalText } from './queueConfigSupport'

  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  const loading = ref(false)
  const holidayLoading = ref(false)
  const holidayLoaded = ref(false)
  const holidayError = ref(false)
  const holidayScope = useTenantRequestScope()
  const holidayActionScope = useTenantRequestScope()
  let holidayActionRevision = 0
  const togglingKey = ref('')
  const loadError = ref<unknown>(null)
  // P2 IA 拆分:route.meta.mode 限定本页只显示某一类资源
  const route = useRoute()
  const router = useRouter()
  const governancePath = computed(() => route.path)
  const governanceOptions = computed(() => {
    const calendars = { label: t('queueConfig.sectionCalendars'), value: '/governance/calendars' }
    if (!canAccess('ADMIN')) return [calendars]
    return [
      { label: t('queueConfig.sectionQueues'), value: '/governance/queues' },
      { label: t('queueConfig.sectionWindows'), value: '/governance/windows' },
      calendars,
    ]
  })
  function onWorkspaceChange(value: string | number | boolean) {
    const path = String(value)
    if (path !== route.path) void router.push({ path, query: route.query })
  }
  const mode = computed<'queues' | 'windows' | 'calendars' | 'all'>(
    () => (route.meta?.mode as 'queues' | 'windows' | 'calendars' | undefined) ?? 'all',
  )
  const showQueuesTab = computed(() => mode.value === 'all' || mode.value === 'queues')
  const showWindowsTab = computed(() => mode.value === 'all' || mode.value === 'windows')
  const showCalendarsTab = computed(() => mode.value === 'all' || mode.value === 'calendars')

  const activeTab = ref<'queues' | 'windows' | 'calendars'>(
    mode.value === 'windows' ? 'windows' : mode.value === 'calendars' ? 'calendars' : 'queues',
  )
  watch(mode, (next) => {
    if (next !== 'all') activeTab.value = next
  })

  // PageHeader 右上"新建"按钮按当前 tab 切换文案与动作
  const activeCreateLabel = computed(() => {
    if (activeTab.value === 'queues') return t('queueConfig.actionCreateQueue')
    if (activeTab.value === 'windows') return t('queueConfig.actionCreateWindow')
    return t('queueConfig.actionCreateCalendar')
  })
  function onCreateClick() {
    if (!canMutateConfig.value) return
    if (activeTab.value === 'queues') openQueueCreate()
    else if (activeTab.value === 'windows') openWindowCreate()
    else openCalendarCreate()
  }
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
  const currentCalendarId = ref<number | null>(null)
  const queueDialogVisible = ref(false)
  const windowDialogVisible = ref(false)
  const calendarDialogVisible = ref(false)
  const holidayDialogVisible = ref(false)
  const queueEditingId = ref<number | null>(null)
  const windowEditingId = ref<number | null>(null)
  const calendarEditingId = ref<number | null>(null)
  const holidayEditingId = ref<number | null>(null)
  const saving = ref(false)
  const pageSize = ref(15)
  const pageQueues = ref(1)
  const pageWindows = ref(1)
  const pageCalendars = ref(1)
  const holidayPage = ref(1)
  const holidayPageSize = ref(15)

  const queueForm = reactive({
    queueCode: '',
    queueName: '',
    queueType: 'MIXED',
    maxRunningJobs: undefined as number | undefined,
    maxRunningPartitions: undefined as number | undefined,
    maxQps: undefined as number | undefined,
    workerGroup: '',
    resourceTag: '',
    priorityPolicy: '',
    fairShareWeight: undefined as number | undefined,
    enabled: true,
    description: '',
  })
  const showQueueValidation = ref(false)
  const queueValidationErrors = computed(() => ({
    queueCode:
      showQueueValidation.value && queueEditingId.value == null && !queueForm.queueCode.trim()
        ? t('queueConfig.requiredField', { label: t('queueConfig.fieldQueueCode') })
        : '',
    queueType:
      showQueueValidation.value && !queueForm.queueType.trim()
        ? t('queueConfig.requiredField', { label: t('queueConfig.fieldQueueType') })
        : '',
  }))

  const windowForm = reactive({
    windowCode: '',
    windowName: '',
    timezone: 'Asia/Shanghai',
    startTime: '00:00:00',
    endTime: '23:59:59',
    endStrategy: '',
    outOfWindowAction: '',
    allowCrossDay: false,
    enabled: true,
    description: '',
  })

  const calendarForm = reactive({
    calendarCode: '',
    calendarName: '',
    timezone: 'Asia/Shanghai',
    holidayRollRule: '',
    catchUpPolicy: '',
    catchUpMaxDays: undefined as number | undefined,
    enabled: true,
  })

  const holidayForm = reactive({
    bizDate: '',
    dayType: 'HOLIDAY',
    holidayName: '',
    description: '',
  })

  function requireText(value: string, label: string) {
    const text = value.trim()
    if (!text) throw new Error(t('queueConfig.requiredField', { label }))
    return text
  }

  function handleValidationError(err: unknown) {
    if (err instanceof Error) ElMessage.warning(userErrorMessage(err))
  }

  const keywordPlaceholder = computed(() => {
    if (activeTab.value === 'windows') return t('queueConfig.keywordWindows')
    if (activeTab.value === 'calendars') return t('queueConfig.keywordCalendars')
    return t('queueConfig.keywordQueues')
  })

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

  const filteredQueues = computed(() =>
    filterGovernanceQueues(queues.value, kwApplied.value, enabledApplied.value),
  )
  const filteredWindows = computed(() =>
    filterGovernanceWindows(windows.value, kwApplied.value, enabledApplied.value),
  )
  const filteredCalendars = computed(() =>
    filterGovernanceCalendars(calendars.value, kwApplied.value, enabledApplied.value),
  )

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

  // 按当前 tab 懒加载:首屏 / 切租户只拉可见 tab 的数据,切 tab 时按需拉并缓存,
  // 避免原先一次性 Promise.all 拉 queues+windows+calendars 三子域拖慢首屏(routed 子页只显 1 个 tab 更明显)。
  const loadedTabs = ref(new Set<string>())

  async function fetchQueues() {
    queues.value = await governanceApi.listQueues(tenant.tenantId)
  }
  async function fetchWindows() {
    windows.value = await governanceApi.listBatchWindows(tenant.tenantId)
  }
  async function fetchCalendars() {
    calendars.value = await governanceApi.listCalendars(tenant.tenantId)
  }

  async function loadActiveTab(force = false) {
    const tab = activeTab.value
    loadError.value = null
    if (!force && loadedTabs.value.has(tab)) return
    loading.value = true
    try {
      if (tab === 'queues') await fetchQueues()
      else if (tab === 'windows') await fetchWindows()
      else if (tab === 'calendars') await fetchCalendars()
      loadedTabs.value.add(tab)
    } catch (error) {
      loadError.value = error
    } finally {
      loading.value = false
    }
  }

  // 保留 load 名字给 useTenantReload / 刷新按钮 / 保存后刷新:清缓存并强制重载当前 tab。
  async function load() {
    loadedTabs.value.clear()
    await loadActiveTab(true)
  }

  // 切 tab 时按需懒加载(命中缓存则不重复请求)。
  watch(activeTab, () => loadActiveTab())

  /** 三种 toggle 的共同骨架:确认 → 调 API → 回写 row.enabled。 */
  async function confirmAndToggle(
    label: string,
    rowId: number | undefined,
    enabledNext: boolean,
    togglingId: string,
    apiCall: () => Promise<unknown>,
    onSuccess: () => void,
  ) {
    if (!canMutateConfig.value || !rowId) return
    try {
      const action = enabledNext ? t('queueConfig.enable') : t('queueConfig.disable')
      await confirmDanger({
        reversible: true,
        verb: action,
        target: `「${label}」`,
        consequence: enabledNext
          ? t('queueConfig.enableConsequence')
          : t('queueConfig.disableConsequence'),
        confirmButtonText: t('queueConfig.confirmToggle', { action }),
      })
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
    const targetLabel = t('queueConfig.queueLabel', { code: row.queueCode })
    return confirmAndToggle(
      targetLabel,
      row.id,
      next,
      `queue-${row.id}`,
      () => governanceApi.toggleQueue(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleWindow(row: GovernanceBatchWindowRow) {
    const next = !row.enabled
    const targetLabel = t('queueConfig.windowLabel', { code: row.windowCode })
    return confirmAndToggle(
      targetLabel,
      row.id,
      next,
      `window-${row.id}`,
      () => governanceApi.toggleBatchWindow(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function toggleCalendar(row: GovernanceCalendarRow) {
    const next = !row.enabled
    const targetLabel = t('queueConfig.calendarLabel', { code: row.calendarCode })
    return confirmAndToggle(
      targetLabel,
      row.id,
      next,
      `calendar-${row.id}`,
      () => governanceApi.toggleCalendar(row.id, row.tenantId ?? tenant.tenantId, next),
      () => (row.enabled = next),
    )
  }

  function openQueueCreate() {
    if (!canMutateConfig.value) return
    queueEditingId.value = null
    showQueueValidation.value = false
    Object.assign(queueForm, {
      queueCode: '',
      queueName: '',
      queueType: 'MIXED',
      maxRunningJobs: undefined,
      maxRunningPartitions: undefined,
      maxQps: undefined,
      workerGroup: '',
      resourceTag: '',
      priorityPolicy: '',
      fairShareWeight: undefined,
      enabled: true,
      description: '',
    })
    queueDialogVisible.value = true
  }

  function openQueueEdit(row: GovernanceQueueRow) {
    if (!canMutateConfig.value) return
    queueEditingId.value = row.id
    showQueueValidation.value = false
    Object.assign(queueForm, {
      queueCode: row.queueCode,
      queueName: row.queueName,
      queueType: row.queueType || 'MIXED',
      maxRunningJobs: row.concurrentCap ?? undefined,
      maxRunningPartitions: undefined,
      maxQps: row.burstLimit ?? undefined,
      workerGroup: '',
      resourceTag: '',
      priorityPolicy: '',
      fairShareWeight: undefined,
      enabled: row.enabled,
      description: '',
    })
    queueDialogVisible.value = true
  }

  function buildQueuePayload(): GovernanceQueueSavePayload {
    return {
      tenantId: tenant.tenantId,
      ...(queueEditingId.value == null
        ? { queueCode: requireText(queueForm.queueCode, t('queueConfig.fieldQueueCode')) }
        : {}),
      queueName: optionalText(queueForm.queueName),
      queueType: requireText(queueForm.queueType, t('queueConfig.fieldQueueType')),
      maxRunningJobs: queueForm.maxRunningJobs,
      maxRunningPartitions: queueForm.maxRunningPartitions,
      maxQps: queueForm.maxQps,
      workerGroup: optionalText(queueForm.workerGroup),
      resourceTag: optionalText(queueForm.resourceTag),
      priorityPolicy: optionalText(queueForm.priorityPolicy),
      fairShareWeight: queueForm.fairShareWeight,
      enabled: queueForm.enabled,
      description: optionalText(queueForm.description),
    }
  }

  async function saveQueue() {
    if (!canMutateConfig.value) return
    showQueueValidation.value = true
    saving.value = true
    try {
      const payload = buildQueuePayload()
      if (queueEditingId.value == null) await governanceApi.createQueue(payload)
      else await governanceApi.updateQueue(queueEditingId.value, payload)
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      queueDialogVisible.value = false
      await load()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  function openWindowCreate() {
    if (!canMutateConfig.value) return
    windowEditingId.value = null
    Object.assign(windowForm, {
      windowCode: '',
      windowName: '',
      timezone: 'Asia/Shanghai',
      startTime: '00:00:00',
      endTime: '23:59:59',
      endStrategy: '',
      outOfWindowAction: '',
      allowCrossDay: false,
      enabled: true,
      description: '',
    })
    windowDialogVisible.value = true
  }

  function openWindowEdit(row: GovernanceBatchWindowRow) {
    if (!canMutateConfig.value) return
    windowEditingId.value = row.id
    Object.assign(windowForm, {
      windowCode: row.windowCode,
      windowName: row.windowName,
      timezone: row.timezone || 'Asia/Shanghai',
      startTime: row.startTime || '00:00:00',
      endTime: row.endTime || '23:59:59',
      endStrategy: row.endStrategy,
      outOfWindowAction: row.outOfWindowAction,
      allowCrossDay: row.allowCrossDay,
      enabled: row.enabled,
      description: row.description,
    })
    windowDialogVisible.value = true
  }

  function buildWindowPayload(): GovernanceBatchWindowSavePayload {
    return {
      tenantId: tenant.tenantId,
      ...(windowEditingId.value == null
        ? { windowCode: requireText(windowForm.windowCode, t('queueConfig.fieldWindowCode')) }
        : {}),
      windowName: optionalText(windowForm.windowName),
      timezone: requireText(windowForm.timezone, t('queueConfig.fieldTimezone')),
      startTime: requireText(windowForm.startTime, t('queueConfig.fieldStartTime')),
      endTime: requireText(windowForm.endTime, t('queueConfig.fieldEndTime')),
      endStrategy: optionalText(windowForm.endStrategy),
      outOfWindowAction: optionalText(windowForm.outOfWindowAction),
      allowCrossDay: windowForm.allowCrossDay,
      enabled: windowForm.enabled,
      description: optionalText(windowForm.description),
    }
  }

  async function saveWindow() {
    if (!canMutateConfig.value) return
    saving.value = true
    try {
      const payload = buildWindowPayload()
      if (windowEditingId.value == null) await governanceApi.createBatchWindow(payload)
      else await governanceApi.updateBatchWindow(windowEditingId.value, payload)
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      windowDialogVisible.value = false
      await load()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  function openCalendarCreate() {
    if (!canMutateConfig.value) return
    calendarEditingId.value = null
    Object.assign(calendarForm, {
      calendarCode: '',
      calendarName: '',
      timezone: 'Asia/Shanghai',
      holidayRollRule: '',
      catchUpPolicy: '',
      catchUpMaxDays: undefined,
      enabled: true,
    })
    calendarDialogVisible.value = true
  }

  function openCalendarEdit(row: GovernanceCalendarRow) {
    if (!canMutateConfig.value) return
    calendarEditingId.value = row.id
    Object.assign(calendarForm, {
      calendarCode: row.calendarCode,
      calendarName: row.calendarName,
      timezone: row.timezone || 'Asia/Shanghai',
      holidayRollRule: '',
      catchUpPolicy: '',
      catchUpMaxDays: undefined,
      enabled: row.enabled,
    })
    calendarDialogVisible.value = true
  }

  function buildCalendarPayload(): GovernanceCalendarSavePayload {
    return {
      tenantId: tenant.tenantId,
      calendarCode: requireText(calendarForm.calendarCode, t('queueConfig.fieldCalendarCode')),
      calendarName: requireText(calendarForm.calendarName, t('queueConfig.fieldCalendarName')),
      timezone: requireText(calendarForm.timezone, t('queueConfig.fieldTimezone')),
      holidayRollRule: optionalText(calendarForm.holidayRollRule),
      catchUpPolicy: optionalText(calendarForm.catchUpPolicy),
      catchUpMaxDays: calendarForm.catchUpMaxDays,
      enabled: calendarForm.enabled,
    }
  }

  async function saveCalendar() {
    if (!canMutateConfig.value) return
    saving.value = true
    try {
      const payload = buildCalendarPayload()
      if (calendarEditingId.value == null) await governanceApi.createCalendar(payload)
      else await governanceApi.updateCalendar(calendarEditingId.value, payload)
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      calendarDialogVisible.value = false
      await load()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  async function openHolidays(row: GovernanceCalendarRow) {
    holidayActionRevision++
    holidayDialogVisible.value = false
    holidayEditingId.value = null
    holidayPage.value = 1
    holidayDrawerVisible.value = true
    currentCalendarId.value = row.id
    holidayDrawerTitle.value = t('queueConfig.holidayDrawerTitleWithCode', {
      code: row.calendarCode,
    })
    await reloadCurrentHolidays()
  }

  function openHolidayCreate() {
    if (!canMutateConfig.value) return
    holidayEditingId.value = null
    Object.assign(holidayForm, {
      bizDate: '',
      dayType: 'HOLIDAY',
      holidayName: '',
      description: '',
    })
    holidayDialogVisible.value = true
  }

  function openHolidayEdit(row: GovernanceCalendarHolidayRow) {
    if (!canMutateConfig.value) return
    holidayEditingId.value = row.id
    Object.assign(holidayForm, {
      bizDate: row.holidayDate,
      dayType: row.holidayType,
      holidayName: row.holidayName,
      description: row.description,
    })
    holidayDialogVisible.value = true
  }

  function buildHolidayPayload(): GovernanceCalendarHolidaySavePayload {
    return {
      tenantId: tenant.tenantId,
      bizDate: requireText(holidayForm.bizDate, t('queueConfig.fieldBizDate')),
      dayType: requireText(holidayForm.dayType, t('queueConfig.fieldDayType')),
      holidayName: optionalText(holidayForm.holidayName),
      description: optionalText(holidayForm.description),
    }
  }

  async function reloadCurrentHolidays() {
    const calendarId = currentCalendarId.value
    const scope = holidayScope.begin()
    holidays.value = []
    holidayLoaded.value = false
    holidayError.value = false
    holidayLoading.value = false
    if (!calendarId || !scope.tenantId) {
      holidayError.value = true
      return
    }
    holidayLoading.value = true
    const isCurrent = () =>
      holidayScope.isCurrent(scope) &&
      holidayDrawerVisible.value &&
      currentCalendarId.value === calendarId
    try {
      const records = await governanceApi.listCalendarHolidays(calendarId, scope.tenantId)
      if (isCurrent()) {
        holidays.value = records
        holidayLoaded.value = true
      }
    } catch {
      if (isCurrent()) holidayError.value = true
    } finally {
      if (isCurrent()) holidayLoading.value = false
    }
  }

  async function saveHoliday() {
    const calendarId = currentCalendarId.value
    if (!canMutateConfig.value || !calendarId || !holidayDialogVisible.value || saving.value) return
    const scope = holidayActionScope.begin()
    const revision = ++holidayActionRevision
    const editingId = holidayEditingId.value
    const isCurrent = () =>
      holidayActionScope.isCurrent(scope) &&
      revision === holidayActionRevision &&
      holidayDrawerVisible.value &&
      currentCalendarId.value === calendarId &&
      canMutateConfig.value
    saving.value = true
    try {
      const payload = buildHolidayPayload()
      if (editingId == null) {
        await governanceApi.createCalendarHoliday(calendarId, payload)
      } else {
        await governanceApi.updateCalendarHoliday(calendarId, editingId, payload)
      }
      if (!isCurrent()) return
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      holidayDialogVisible.value = false
      await reloadCurrentHolidays()
    } catch (err) {
      if (isCurrent()) handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  async function deleteHoliday(row: GovernanceCalendarHolidayRow) {
    const calendarId = currentCalendarId.value
    if (!canMutateConfig.value || !calendarId || !row.id) return
    const scope = holidayActionScope.begin()
    const revision = ++holidayActionRevision
    const isCurrent = () =>
      holidayActionScope.isCurrent(scope) &&
      revision === holidayActionRevision &&
      holidayDrawerVisible.value &&
      currentCalendarId.value === calendarId &&
      canMutateConfig.value
    try {
      await confirmDanger({
        verb: t('common.delete'),
        target: t('queueConfig.holidayTarget', { date: row.holidayDate }),
        consequence: t('queueConfig.holidayConsequence'),
        irreversible: true,
      })
    } catch {
      return
    }
    if (!isCurrent()) return
    await governanceApi.deleteCalendarHoliday(calendarId, row.id, scope.tenantId)
    if (!isCurrent()) return
    ElMessage.success(t('fileTemplateList.saveSuccess'))
    await reloadCurrentHolidays()
  }

  watch(activeTab, () => {
    kwDraft.value = ''
    enabledDraft.value = undefined
    kwApplied.value = ''
    enabledApplied.value = undefined
    resetListPages()
  })
  watch(
    () => tenant.tenantId,
    () => {
      holidayActionRevision++
      holidayDrawerVisible.value = false
      holidayDialogVisible.value = false
      currentCalendarId.value = null
      holidays.value = []
      holidayLoaded.value = false
      holidayLoading.value = false
      holidayError.value = false
    },
    { flush: 'sync' },
  )
  watch(holidayDrawerVisible, (visible) => {
    if (!visible) {
      holidayActionRevision++
      holidayLoading.value = false
      holidayLoaded.value = false
      holidays.value = []
    }
  })
  useTenantReload(load)
</script>

<style scoped src="./QueueConfig.css"></style>
