<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="onCreateClick">
          {{ activeCreateLabel }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        class="pill-tabs governance-tabs"
        :class="{ 'single-mode': mode !== 'all' }"
      >
        <el-tab-pane v-if="showQueuesTab" :label="t('queueConfig.tabQueues')" name="queues">
          <div class="panel-head">
            <div class="panel-title">
              <span class="dot dot--primary" />
              {{ t('queueConfig.sectionQueues') }}
            </div>
          </div>
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
              width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="queueName"
              :label="t('queueConfig.colQueueName')"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column prop="queueType" :label="t('queueConfig.colQueueType')" width="120" />
            <el-table-column
              prop="fairShareGroup"
              :label="t('queueConfig.colFairShareGroup')"
              width="180"
              show-overflow-tooltip
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
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110">
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
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.queueCode"
                  @click="openQueueEdit(row)"
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

        <el-tab-pane v-if="showWindowsTab" :label="t('queueConfig.tabWindows')" name="windows">
          <div class="panel-head">
            <div class="panel-title">
              <span class="dot dot--warning" />
              {{ t('queueConfig.sectionWindows') }}
            </div>
          </div>
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
              width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="windowName"
              :label="t('queueConfig.colWindowName')"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column prop="startTime" :label="t('queueConfig.colStartTime')" width="110" />
            <el-table-column prop="endTime" :label="t('queueConfig.colEndTime')" width="110" />
            <el-table-column
              prop="crossDayPolicy"
              :label="t('queueConfig.colCrossDayPolicy')"
              width="150"
            />
            <el-table-column
              prop="outOfWindowAction"
              :label="t('queueConfig.colOutOfWindow')"
              width="160"
            />
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colEnabled')" width="110">
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
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.windowCode"
                  @click="openWindowEdit(row)"
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
          v-if="showCalendarsTab"
          :label="t('queueConfig.tabCalendars')"
          name="calendars"
        >
          <div class="panel-head">
            <div class="panel-title">
              <span class="dot dot--success" />
              {{ t('queueConfig.sectionCalendars') }}
            </div>
          </div>
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
              show-overflow-tooltip
            />
            <el-table-column
              prop="calendarName"
              :label="t('queueConfig.colCalendarName')"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column prop="timezone" :label="t('queueConfig.colTimezone')" width="160" />
            <DatetimeColumn prop="updatedAt" :label="t('queueConfig.colUpdatedAt')" width="180" />
            <el-table-column :label="t('queueConfig.colHolidays')" min-width="128">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openHolidays(row)">
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
                  inline-prompt
                  :active-text="t('queueConfig.switchOn')"
                  :inactive-text="t('queueConfig.switchOff')"
                  @change="toggleCalendar(row)"
                />
              </template>
            </el-table-column>
            <el-table-column :label="t('fileTemplateList.colActions')" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  plain
                  size="small"
                  :icon="Edit"
                  :disabled="!row?.calendarCode"
                  @click="openCalendarEdit(row)"
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
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="holidayDrawerVisible"
      :title="holidayDrawerTitle"
      size="480px"
      destroy-on-close
    >
      <div class="config-toolbar">
        <el-button
          type="primary"
          :icon="Plus"
          :disabled="!currentCalendarId"
          @click="openHolidayCreate"
        >
          {{ t('common.create') }}
        </el-button>
      </div>
      <el-table
        v-loading="holidayLoading"
        :data="pagedHolidays.records"
        stripe
        border
        size="small"
        highlight-current-row
        class="console-table"
        :empty-text="t('common.noData')"
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
        <el-table-column :label="t('fileTemplateList.colActions')" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                type="primary"
                plain
                size="small"
                :icon="Edit"
                @click="openHolidayEdit(row)"
              >
                {{ t('common.edit') }}
              </el-button>
              <el-button
                type="danger"
                plain
                size="small"
                :icon="Delete"
                @click="deleteHoliday(row)"
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

    <el-drawer
      :append-to-body="true"
      v-model="queueDialogVisible"
      :title="
        queueEditingId == null ? t('queueConfig.queueCreateTitle') : t('queueConfig.queueEditTitle')
      "
      direction="rtl"
      size="640px"
      destroy-on-close
    >
      <el-form :model="queueForm" label-width="120px">
        <el-form-item :label="t('queueConfig.fieldQueueCode')" required>
          <el-input
            v-model="queueForm.queueCode"
            :disabled="queueEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldQueueName')"
          ><el-input v-model="queueForm.queueName" maxlength="256"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldQueueType')" required
          ><el-input v-model="queueForm.queueType" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldMaxRunningJobs')"
          ><el-input-number v-model="queueForm.maxRunningJobs" :min="0"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldMaxRunningPartitions')"
          ><el-input-number v-model="queueForm.maxRunningPartitions" :min="0"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldMaxQps')"
          ><el-input-number v-model="queueForm.maxQps" :min="0"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldWorkerGroup')"
          ><el-input v-model="queueForm.workerGroup" maxlength="128"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldResourceTag')"
          ><el-input v-model="queueForm.resourceTag" maxlength="64"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldPriorityPolicy')"
          ><el-input v-model="queueForm.priorityPolicy" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldFairShareWeight')"
          ><el-input-number v-model="queueForm.fairShareWeight" :min="0"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldEnabled')"
          ><el-switch v-model="queueForm.enabled"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldDescription')"
          ><el-input
            v-model="queueForm.description"
            type="textarea"
            maxlength="512"
            show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="queueDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveQueue">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="windowDialogVisible"
      :title="
        windowEditingId == null
          ? t('queueConfig.windowCreateTitle')
          : t('queueConfig.windowEditTitle')
      "
      direction="rtl"
      size="640px"
      destroy-on-close
    >
      <el-form :model="windowForm" label-width="120px">
        <el-form-item :label="t('queueConfig.fieldWindowCode')" required>
          <el-input
            v-model="windowForm.windowCode"
            :disabled="windowEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldWindowName')"
          ><el-input v-model="windowForm.windowName" maxlength="256"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldTimezone')" required
          ><el-input v-model="windowForm.timezone" maxlength="64"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldStartTime')" required
          ><el-time-picker v-model="windowForm.startTime" value-format="HH:mm:ss"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldEndTime')" required
          ><el-time-picker v-model="windowForm.endTime" value-format="HH:mm:ss"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldEndStrategy')"
          ><el-input v-model="windowForm.endStrategy" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldOutOfWindowAction')"
          ><el-input v-model="windowForm.outOfWindowAction" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldAllowCrossDay')"
          ><el-switch v-model="windowForm.allowCrossDay"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldEnabled')"
          ><el-switch v-model="windowForm.enabled"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldDescription')"
          ><el-input
            v-model="windowForm.description"
            type="textarea"
            maxlength="512"
            show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="windowDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveWindow">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="calendarDialogVisible"
      :title="
        calendarEditingId == null
          ? t('queueConfig.calendarCreateTitle')
          : t('queueConfig.calendarEditTitle')
      "
      direction="rtl"
      size="640px"
      destroy-on-close
    >
      <el-form :model="calendarForm" label-width="120px">
        <el-form-item :label="t('queueConfig.fieldCalendarCode')" required>
          <el-input
            v-model="calendarForm.calendarCode"
            :disabled="calendarEditingId != null"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('queueConfig.fieldCalendarName')" required
          ><el-input v-model="calendarForm.calendarName" maxlength="256"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldTimezone')" required
          ><el-input v-model="calendarForm.timezone" maxlength="64"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldHolidayRollRule')"
          ><el-input v-model="calendarForm.holidayRollRule" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldCatchUpPolicy')"
          ><el-input v-model="calendarForm.catchUpPolicy" maxlength="32"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldCatchUpMaxDays')"
          ><el-input-number v-model="calendarForm.catchUpMaxDays" :min="0"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldEnabled')"
          ><el-switch v-model="calendarForm.enabled"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="calendarDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveCalendar">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="holidayDialogVisible"
      :title="
        holidayEditingId == null
          ? t('queueConfig.holidayCreateTitle')
          : t('queueConfig.holidayEditTitle')
      "
      direction="rtl"
      size="480px"
      destroy-on-close
    >
      <el-form :model="holidayForm" label-width="120px">
        <el-form-item :label="t('queueConfig.fieldBizDate')" required
          ><el-date-picker v-model="holidayForm.bizDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item :label="t('queueConfig.fieldDayType')" required
          ><el-input v-model="holidayForm.dayType" maxlength="32"
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
      <template #footer>
        <el-button @click="holidayDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveHoliday">{{
          t('common.save')
        }}</el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { Delete, Edit, Plus } from '@element-plus/icons-vue'

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
  // P2 IA 拆分:route.meta.mode 限定本页只显示某一类资源
  const route = useRoute()
  const mode = computed<'queues' | 'windows' | 'calendars' | 'all'>(
    () => (route.meta?.mode as 'queues' | 'windows' | 'calendars' | undefined) ?? 'all',
  )
  const showQueuesTab = computed(() => mode.value === 'all' || mode.value === 'queues')
  const showWindowsTab = computed(() => mode.value === 'all' || mode.value === 'windows')
  const showCalendarsTab = computed(() => mode.value === 'all' || mode.value === 'calendars')

  const activeTab = ref<'queues' | 'windows' | 'calendars'>(
    mode.value === 'windows' ? 'windows' : mode.value === 'calendars' ? 'calendars' : 'queues',
  )

  // PageHeader 右上"新建"按钮按当前 tab 切换文案与动作
  const activeCreateLabel = computed(() => {
    if (activeTab.value === 'queues') return t('queueConfig.actionCreateQueue')
    if (activeTab.value === 'windows') return t('queueConfig.actionCreateWindow')
    return t('queueConfig.actionCreateCalendar')
  })
  function onCreateClick() {
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
  const pageSize = ref(20)
  const pageQueues = ref(1)
  const pageWindows = ref(1)
  const pageCalendars = ref(1)
  const holidayPage = ref(1)
  const holidayPageSize = ref(20)

  const queueForm = reactive({
    queueCode: '',
    queueName: '',
    queueType: 'DEFAULT',
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

  function optionalText(value: string) {
    const text = value.trim()
    return text ? text : undefined
  }

  function requireText(value: string, label: string) {
    const text = value.trim()
    if (!text) throw new Error(`${label} 必填`)
    return text
  }

  function handleValidationError(err: unknown) {
    if (err instanceof Error) ElMessage.warning(err.message)
  }

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
      await confirmDanger({
        verb: action,
        target: `「${label}」`,
        consequence: enabledNext
          ? '该队列/窗口恢复参与调度,排队中的任务将被派发。'
          : '该队列/窗口停止参与调度,挂在其上的任务不会被派发,直到再次启用。',
        confirmButtonText: `确认${action}`,
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

  function openQueueCreate() {
    queueEditingId.value = null
    Object.assign(queueForm, {
      queueCode: '',
      queueName: '',
      queueType: 'DEFAULT',
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
    queueEditingId.value = row.id
    Object.assign(queueForm, {
      queueCode: row.queueCode,
      queueName: row.queueName,
      queueType: row.queueType || 'DEFAULT',
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
        ? { queueCode: requireText(queueForm.queueCode, 'queueCode') }
        : {}),
      queueName: optionalText(queueForm.queueName),
      queueType: requireText(queueForm.queueType, 'queueType'),
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
        ? { windowCode: requireText(windowForm.windowCode, 'windowCode') }
        : {}),
      windowName: optionalText(windowForm.windowName),
      timezone: requireText(windowForm.timezone, 'timezone'),
      startTime: requireText(windowForm.startTime, 'startTime'),
      endTime: requireText(windowForm.endTime, 'endTime'),
      endStrategy: optionalText(windowForm.endStrategy),
      outOfWindowAction: optionalText(windowForm.outOfWindowAction),
      allowCrossDay: windowForm.allowCrossDay,
      enabled: windowForm.enabled,
      description: optionalText(windowForm.description),
    }
  }

  async function saveWindow() {
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
      calendarCode: requireText(calendarForm.calendarCode, 'calendarCode'),
      calendarName: requireText(calendarForm.calendarName, 'calendarName'),
      timezone: requireText(calendarForm.timezone, 'timezone'),
      holidayRollRule: optionalText(calendarForm.holidayRollRule),
      catchUpPolicy: optionalText(calendarForm.catchUpPolicy),
      catchUpMaxDays: calendarForm.catchUpMaxDays,
      enabled: calendarForm.enabled,
    }
  }

  async function saveCalendar() {
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
    holidayPage.value = 1
    holidayDrawerVisible.value = true
    currentCalendarId.value = row.id
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

  function openHolidayCreate() {
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
      bizDate: requireText(holidayForm.bizDate, 'bizDate'),
      dayType: requireText(holidayForm.dayType, 'dayType'),
      holidayName: optionalText(holidayForm.holidayName),
      description: optionalText(holidayForm.description),
    }
  }

  async function reloadCurrentHolidays() {
    if (!currentCalendarId.value) return
    holidays.value = await governanceApi.listCalendarHolidays(
      currentCalendarId.value,
      tenant.tenantId,
    )
  }

  async function saveHoliday() {
    if (!currentCalendarId.value) return
    saving.value = true
    try {
      const payload = buildHolidayPayload()
      if (holidayEditingId.value == null) {
        await governanceApi.createCalendarHoliday(currentCalendarId.value, payload)
      } else {
        await governanceApi.updateCalendarHoliday(
          currentCalendarId.value,
          holidayEditingId.value,
          payload,
        )
      }
      ElMessage.success(t('fileTemplateList.saveSuccess'))
      holidayDialogVisible.value = false
      await reloadCurrentHolidays()
    } catch (err) {
      handleValidationError(err)
    } finally {
      saving.value = false
    }
  }

  async function deleteHoliday(row: GovernanceCalendarHolidayRow) {
    if (!currentCalendarId.value || !row.id) return
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
    await governanceApi.deleteCalendarHoliday(currentCalendarId.value, row.id, tenant.tenantId)
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

  useTenantReload(load)
</script>

<style scoped>
  .governance-tabs :deep(.el-tabs__content) {
    padding-top: 10px;
    overflow: visible;
  }

  /* P2 单模式路由(/governance/queues|windows|calendars):隐藏 tab 头 */
  .governance-tabs.single-mode :deep(.el-tabs__header) {
    display: none;
  }
  .governance-tabs.single-mode :deep(.el-tabs__content) {
    padding-top: 0;
  }

  .panel-head {
    margin-bottom: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .panel-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
  }

  .dot--primary {
    background: var(--color-primary);
  }

  .dot--warning {
    background: var(--color-warning);
  }

  .dot--success {
    background: var(--color-success);
  }
</style>
