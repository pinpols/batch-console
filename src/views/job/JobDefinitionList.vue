<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canMutateConfig"
          :icon="Plus"
          @click="router.push('/jobs/definitions/new')"
        >
          向导新建
        </el-button>
        <el-button
          v-if="canMutateConfig"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          {{ t('jobDefinitionList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="filtered"
        :loading="tableBlocking"
        :error="jobLoadError"
        :on-retry="
          () => {
            void refetch()
          }
        "
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="queryActionBusy"
            :refresh-busy="isFetching"
            :disabled="isPending"
            @search="onSearch"
            @reset="reset"
            @refresh="onRefreshDefinitions"
          >
            <el-form-item :label="t('jobDefinitionList.jobCodeLabel')">
              <el-input
                class="query-w-160"
                v-model="filters.jobCode"
                clearable
                :placeholder="t('jobDefinitionList.jobCodePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('jobDefinitionList.jobNameLabel')">
              <el-input
                class="query-w-160"
                v-model="filters.jobName"
                clearable
                :placeholder="t('jobDefinitionList.jobNamePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('jobDefinitionList.enabledLabel')">
              <el-select
                class="query-w-120"
                v-model="filters.enabled"
                clearable
                :placeholder="t('jobDefinitionList.enabledPlaceholder')"
              >
                <el-option :label="t('jobDefinitionList.optEnabled')" :value="true" />
                <el-option :label="t('jobDefinitionList.optDisabled')" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobDefinitionList.workerGroupTip')">
                  {{ t('jobDefinitionList.workerGroupLabel') }}
                </HelpLabel>
              </template>
              <el-select
                class="query-w-180"
                v-model="filters.workerGroup"
                clearable
                filterable
                :placeholder="t('jobDefinitionList.workerGroupPlaceholder')"
              >
                <el-option
                  v-for="option in workerGroupOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobDefinitionList.queueTip')">
                  {{ t('jobDefinitionList.queueLabel') }}
                </HelpLabel>
              </template>
              <MetaSelect
                class="query-w-160"
                v-model="filters.queueCode"
                clearable
                filterable
                :placeholder="t('jobDefinitionList.queuePlaceholder')"
                :options="queueOptions"
              />
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel :tip="t('jobDefinitionList.scheduleTypeTip')">
                  {{ t('jobDefinitionList.scheduleTypeLabel') }}
                </HelpLabel>
              </template>
              <MetaSelect
                class="query-w-160"
                v-model="filters.scheduleType"
                clearable
                enum-key="scheduleType"
                :placeholder="t('jobDefinitionList.scheduleTypePlaceholder')"
                :options="scheduleTypeOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('jobDefinitionList.emptyTitle')"
            :description="t('jobDefinitionList.emptyDescription')"
            :image-size="80"
          >
            <template #action>
              <el-button
                type="primary"
                :icon="Upload"
                @click="$router.push('/config/tenant-package')"
              >
                {{ t('jobDefinitionList.emptyGoImport') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <el-table-column prop="jobCode" :label="t('jobDefinitionList.colJobCode')" width="220">
          <template #default="{ row }">
            <router-link class="definition-link" :to="definitionDetailLocation(row)">
              {{ row.jobCode }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column
          prop="jobName"
          :label="t('jobDefinitionList.colJobName')"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          prop="tenantId"
          :label="t('jobDefinitionList.colTenant')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="workerGroup"
          :label="t('jobDefinitionList.colWorkerGroup')"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="queueCode"
          :label="t('jobDefinitionList.colQueue')"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="scheduleType"
          :label="t('jobDefinitionList.colScheduleType')"
          width="120"
        >
          <template #default="{ row }">
            {{ resolveScheduleType(row.scheduleType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="executionMode"
          :label="t('jobDefinitionList.colExecutionMode')"
          width="110"
        >
          <template #default="{ row }">
            <StatusTag :value="row.executionMode || 'FULL'" category="executionMode" />
          </template>
        </el-table-column>
        <el-table-column prop="enabled" :label="t('jobDefinitionList.colEnabled')" width="80">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <el-table-column
          prop="scheduleExpr"
          :label="t('jobDefinitionList.colScheduleExpr')"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column :label="t('jobDefinitionList.colActions')" width="360" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" :inline-limit="4" />
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="createDrawerVisible"
      :title="t('jobDefinitionList.drawerCreateTitle')"
      size="520px"
      :before-close="onCreateDrawerClose"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createFormRules"
        label-width="120px"
        @submit.prevent
      >
        <el-form-item :label="t('jobDefinitionList.fieldJobCode')" prop="jobCode">
          <el-input
            v-model="createForm.jobCode"
            maxlength="128"
            show-word-limit
            :placeholder="t('jobDefinitionList.createJobCodePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.fieldJobName')" prop="jobName">
          <el-input
            v-model="createForm.jobName"
            maxlength="256"
            :placeholder="t('jobDefinitionList.createJobNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.fieldJobType')" prop="jobType">
          <MetaSelect
            v-model="createForm.jobType"
            class="query-w-full"
            enum-key="jobType"
            :placeholder="t('jobDefinitionList.createJobTypePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.fieldScheduleType')" prop="scheduleType">
          <MetaSelect
            v-model="createForm.scheduleType"
            class="query-w-full"
            enum-key="scheduleType"
            :options="scheduleTypeOptions"
            :placeholder="t('jobDefinitionList.scheduleTypePlaceholder')"
          />
        </el-form-item>
        <el-form-item
          v-if="createForm.scheduleType !== 'MANUAL'"
          :label="t('jobDefinitionList.fieldScheduleExpr')"
          prop="scheduleExpr"
        >
          <CronExprInput v-model="createForm.scheduleExpr" />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.queueLabel')" prop="queueCode">
          <div class="queue-field">
            <MetaSelect
              v-model="createForm.queueCode"
              class="query-w-full"
              clearable
              filterable
              :placeholder="
                queueOptions.length
                  ? t('jobDefinitionList.queuePlaceholder')
                  : '当前租户无队列,可前往治理页新建后再回来'
              "
              :options="queueOptions"
            />
            <el-button
              v-if="!queueOptions.length"
              link
              type="primary"
              @click="router.push('/governance/queues')"
            >
              + 新建队列
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.workerGroupLabel')" prop="workerGroup">
          <el-select
            v-model="createForm.workerGroup"
            class="query-w-full"
            filterable
            allow-create
            clearable
            default-first-option
            :placeholder="t('jobDefinitionList.workerGroupPlaceholder')"
          >
            <el-option
              v-for="option in workerGroupOptions"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.fieldExecutionMode')" prop="executionMode">
          <MetaSelect
            v-model="createForm.executionMode"
            class="query-w-full"
            enum-key="executionMode"
            :options="executionModeOptions"
          />
        </el-form-item>
        <el-form-item
          v-if="createForm.executionMode === 'INCREMENTAL'"
          :label="t('jobDefinitionList.fieldWatermark')"
          prop="watermarkField"
        >
          <el-input
            v-model="createForm.watermarkField"
            :placeholder="t('jobDefinitionList.fieldWatermarkPlaceholder')"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.enabledLabel')" prop="enabled">
          <el-switch v-model="createForm.enabled" />
        </el-form-item>
        <div class="drawer-actions">
          <el-button @click="closeCreateDrawer">{{
            t('jobDefinitionList.drawerCancel')
          }}</el-button>
          <el-button type="primary" :loading="createSaving" @click="submitCreate">
            {{ t('jobDefinitionList.drawerCreateSubmit') }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="editDrawerVisible"
      :title="editDrawerTitle"
      size="640px"
      :before-close="onEditDrawerClose"
    >
      <!--
        Day 2 (A.1):编辑 drawer 从 2 字段扩到 24 字段,对齐 BE JobDefinitionUpdateRequest。
        表单内容抽到 <JobConfigBasicForm> 组件,后续 Day 8+ 新建向导复用相同组件。
      -->
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-width="120px"
        @submit.prevent
      >
        <JobConfigBasicForm
          :model="editForm"
          :tenant-id="editingTenantId"
          :execution-mode-options="executionModeOptions"
          :schedule-type-options="scheduleTypeOptions"
          :queue-options="queueOptions"
          :worker-group-options="workerGroupOptionsMeta"
        />
        <div class="drawer-actions">
          <el-button @click="closeEditDrawer">{{ t('jobDefinitionList.drawerCancel') }}</el-button>
          <el-button type="primary" :loading="editSaving" @click="submitEdit">
            {{ t('jobDefinitionList.drawerSave') }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>

    <!-- Run-centric 详情抽屉(P2):Overview + 最近运行 inline -->
    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('jobDefinitionList.detailTitle', { code: detailRow?.jobCode || '' })"
      size="720px"
    >
      <el-tabs v-if="detailRow" v-model="activeDetailTab">
        <el-tab-pane name="overview" :label="t('jobDefinitionList.detailTabOverview')">
          <JobConfigBasicSection
            :job="detailRow"
            :execution-mode-label="resolveEnumLabel('executionMode', detailRow.executionMode)"
          />
        </el-tab-pane>

        <!--
          Day 6:关联文件 Tab。lazy 让 tab 真打开时才挂载。
          ※ 不能用 `v-if` 在 el-tab-pane 上(EP unmount bug,panes.indexOf undefined)。
          tab 标签常驻,内部按 jobType 条件渲染。
        -->
        <el-tab-pane
          name="related-files"
          :label="t('jobDefinitionList.detailTabRelatedFiles')"
          :lazy="true"
        >
          <JobRelatedFilesTab
            v-if="detailRow.jobType === 'IMPORT' || detailRow.jobType === 'EXPORT'"
            :tenant-id="detailRow.tenantId"
            :job-code="detailRow.jobCode"
          />
          <el-empty v-else description="此作业类型不涉及文件管道(仅 IMPORT / EXPORT 作业)" />
        </el-tab-pane>

        <el-tab-pane name="runs" :lazy="true">
          <template #label>
            <span>
              {{ t('jobDefinitionList.detailTabRuns') }}
              <el-tag v-if="detailRunsRows.length" size="small" round>{{
                detailRunsRows.length
              }}</el-tag>
            </span>
          </template>
          <div class="detail-runs-header">
            <span>{{ t('jobDefinitionList.detailRunsHint', { code: detailRow.jobCode }) }}</span>
            <el-button text type="primary" @click="goInstances(detailRow.jobCode)">
              {{ t('runs.viewAll') }} →
            </el-button>
          </div>
          <el-table
            v-loading="detailRunsLoading"
            :data="detailRunsRows"
            size="small"
            empty-text="—"
            stripe
            @row-click="goJobInstance"
          >
            <el-table-column :label="t('runs.colInstance')" min-width="200">
              <template #default="{ row }">
                <span class="cell-link">{{ row.instanceNo }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('runs.colStatus')" width="110">
              <template #default="{ row }">
                <StatusTag :value="row.instanceStatus" category="instance" />
              </template>
            </el-table-column>
            <el-table-column prop="bizDate" :label="t('runs.colBizDate')" width="110" />
            <el-table-column :label="t('runs.colStarted')" width="160">
              <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Upload } from '@element-plus/icons-vue'
  type ExecutionMode = 'FULL' | 'INCREMENTAL' | 'CDC'
  const { t, te } = useI18n({ useScope: 'global' })

  function resolveScheduleType(value?: string | null): string {
    if (!value) return ''
    const key = `enum.scheduleType.${value}`
    return te(key) ? t(key) : value
  }
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import { jobApi } from '@/api/job'
  import { instanceApi } from '@/api/instance'
  import { fmtDatetime } from '@/utils/datetime'
  import { getMetaEnums, getMetaQueues, type MetaOption } from '@/api/meta'
  import { usePermission } from '@/composables/usePermission'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useJobDefinitionsPaged } from '@/composables/queries/useJobDefinitionsPaged'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import PageContainer from '@/components/common/PageContainer.vue'
  import JobConfigBasicSection from './components/JobConfigBasicSection.vue'
  import JobConfigBasicForm from './components/JobConfigBasicForm.vue'
  import CronExprInput from './components/CronExprInput.vue'
  import JobRelatedFilesTab from './components/JobRelatedFilesTab.vue'
  import {
    type JobEditFormState,
    createEmptyJobEditForm,
    jobResponseToEditForm,
  } from './jobEditFormTypes'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import type {
    ConsoleJobDefinitionResponse,
    ConsoleJobInstanceResponse,
  } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { canMutateConfig } = usePermission()
  const page = ref(1)
  const pageSize = ref(20)
  const actingJobCode = ref('')
  const exportingJobCode = ref('')
  const queueOptions = ref<MetaOption[]>([])
  const scheduleTypeOptions = ref<MetaOption[]>([])
  const filters = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    jobName: '',
    enabled: undefined as boolean | undefined,
    workerGroup: '',
    queueCode: '',
    scheduleType: '',
  })

  const filterTenantRef = computed(() => filters.tenantId)
  // 服务端过滤参数：后端 queryJobDefinitions 仅支持 jobCode / enabled；
  // 次要过滤（jobName / workerGroup / queueCode / scheduleType）后端未暴露
  // → 放到"本页前端过滤"。要完整搜索须用 Job Code / 启用状态。
  const serverJobCode = computed(() => filters.jobCode.trim() || undefined)
  const serverEnabled = computed<boolean | undefined>(() => filters.enabled ?? undefined)
  const {
    data,
    isPending,
    isFetching,
    error: jobLoadError,
    refetch,
  } = useJobDefinitionsPaged({
    page,
    pageSize,
    jobCode: serverJobCode,
    enabled: serverEnabled,
    tenantIdOverride: filterTenantRef,
  })

  const remoteBlocking = computed(() => isPending.value || isFetching.value)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(remoteBlocking)

  const pageRows = computed(() => data.value?.records ?? [])

  const workerGroupOptions = computed(() =>
    Array.from(
      new Set(pageRows.value.map((row) => row.workerGroup).filter((v): v is string => !!v)),
    ),
  )
  // JobConfigBasicForm 的 :worker-group-options 期望 MetaOption[] ({value,label})
  const workerGroupOptionsMeta = computed(() =>
    workerGroupOptions.value.map((v) => ({ value: v, label: v })),
  )

  /** 只对后端未暴露的次要 filter（jobName / workerGroup / queueCode / scheduleType）做本页过滤。 */
  const filtered = computed(() => {
    return pageRows.value.filter((row) => {
      if (filters.jobName.trim() && !row.jobName?.includes(filters.jobName.trim())) return false
      if (filters.workerGroup.trim() && !row.workerGroup?.includes(filters.workerGroup.trim())) {
        return false
      }
      if (filters.queueCode.trim() && !row.queueCode?.includes(filters.queueCode.trim())) {
        return false
      }
      if (filters.scheduleType.trim() && !row.scheduleType?.includes(filters.scheduleType.trim())) {
        return false
      }
      return true
    })
  })

  const total = computed(() => data.value?.total ?? 0)

  function onSearch() {
    return runSearch(() => {
      page.value = 1
    })
  }

  function reset() {
    return runReset(() => {
      filters.tenantId = tenant.tenantId
      filters.jobCode = ''
      filters.jobName = ''
      filters.enabled = undefined
      filters.workerGroup = ''
      filters.queueCode = ''
      filters.scheduleType = ''
      page.value = 1
    })
  }

  function onRefreshDefinitions() {
    return runRefresh(async () => {
      await refetch()
    })
  }

  function goInstances(jobCode: string) {
    // 从定义跳到该 job 的实例列表:列表默认锚今日,这里看的是"该 job 的历史运行",清掉日期
    // 跳转前关闭详情 drawer,避免跳到目标页 drawer 还罩着(同路由 query-only 跳转不会触发组件卸载)
    detailVisible.value = false
    void router.push({
      path: '/monitor/job-instances',
      query: { jobCode, range: 'all' },
    })
  }

  // ── 行操作工厂(给 <RowActions> 用)─────────────────────────
  function rowActions(row: ConsoleJobDefinitionResponse): RowAction[] {
    const acting = actingJobCode.value === row.jobCode
    return [
      {
        key: 'trigger',
        label: t('jobDefinitionList.actionTrigger'),
        primary: true,
        loading: acting,
        onClick: () => triggerRow(row),
      },
      {
        key: 'edit',
        label: t('jobDefinitionList.actionEdit'),
        onClick: () => openEdit(row),
      },
      {
        key: 'instances',
        // 旧"查看运行"会跳到 /monitor/job-instances 离开列表;
        // 现在改成 inline detail drawer + Runs tab,保留 oncall 上下文,
        // tab 内仍有"查看全部"链接通向完整可筛列表。
        label: t('jobDefinitionList.actionInstances'),
        onClick: () => openDetail(row, 'runs'),
      },
      {
        key: 'clone',
        label: t('jobDefinitionList.actionClone'),
        onClick: () => cloneRow(row),
      },
      {
        key: 'export-bundle',
        label: '导出 Bundle',
        loading: exportingJobCode.value === row.jobCode,
        onClick: () => exportBundle(row),
      },
      {
        key: 'toggle',
        label: row.enabled
          ? t('jobDefinitionList.actionDisable')
          : t('jobDefinitionList.actionEnable'),
        danger: row.enabled,
        divided: true,
        disabled: acting,
        onClick: () => toggleRow(row),
      },
    ]
  }

  function definitionDetailLocation(row: ConsoleJobDefinitionResponse) {
    return {
      path: `/jobs/definitions/${row.id}`,
      query: { tenantId: row.tenantId || filters.tenantId || tenant.tenantId },
    }
  }

  async function exportBundle(row: ConsoleJobDefinitionResponse) {
    exportingJobCode.value = row.jobCode
    try {
      const payload = await jobApi.exportBundle(
        row.tenantId || filters.tenantId || tenant.tenantId,
        row.jobCode,
      )
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `job-bundle-${row.jobCode}.json`
      a.click()
      URL.revokeObjectURL(url)
      ElMessage.success(`作业 ${row.jobCode} Bundle 已导出`)
    } finally {
      exportingJobCode.value = ''
    }
  }

  async function loadMeta() {
    const [enums, queues] = await Promise.all([
      getMetaEnums(),
      getMetaQueues(filters.tenantId || tenant.tenantId),
    ])
    scheduleTypeOptions.value = enums.scheduleType ?? []
    queueOptions.value = queues
  }

  async function toggleRow(row: ConsoleJobDefinitionResponse) {
    try {
      const action = row.enabled
        ? t('jobDefinitionList.actionDisable')
        : t('jobDefinitionList.actionEnable')
      await ElMessageBox.confirm(
        t('jobDefinitionList.toggleConfirmText', { action, code: row.jobCode }),
        t('jobDefinitionList.toggleConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    actingJobCode.value = row.jobCode
    try {
      await jobApi.toggleEnabled(
        row.jobCode,
        row.tenantId || filters.tenantId || tenant.tenantId,
        !row.enabled,
      )
      const action = row.enabled
        ? t('jobDefinitionList.actionDisable')
        : t('jobDefinitionList.actionEnable')
      ElMessage.success(t('jobDefinitionList.toggleSuccess', { action, code: row.jobCode }))
      await refetch()
    } finally {
      actingJobCode.value = ''
    }
  }

  async function triggerRow(row: ConsoleJobDefinitionResponse) {
    let payloadText = ''
    try {
      // inputValidator 在用户点"确认"时实时拦截 JSON 语法错,
      // 而不是关掉对话框、ElMessage 再 toast,避免用户白填一大坨参数。
      const { value } = await ElMessageBox.prompt(
        t('jobDefinitionList.triggerPrompt'),
        t('jobDefinitionList.triggerTitle', { code: row.jobCode }),
        {
          inputType: 'textarea',
          inputValue: '{}',
          confirmButtonText: t('jobDefinitionList.triggerConfirm'),
          cancelButtonText: t('common.cancel'),
          inputValidator: (v: string) => {
            const text = v?.trim() || '{}'
            try {
              JSON.parse(text)
              return true
            } catch {
              return t('jobDefinitionList.triggerInvalidJson')
            }
          },
        },
      )
      payloadText = value?.trim() || '{}'
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error(t('jobDefinitionList.triggerInvalidJson'))
      return
    }
    actingJobCode.value = row.jobCode
    try {
      await jobApi.trigger(
        row.jobCode,
        filters.tenantId || tenant.tenantId,
        JSON.parse(payloadText),
      )
      // 替换"已触发"toast → 引导用户去监控页跟踪刚刚触发的实例
      // 体检"病根 2:做完就完事"——触发后最自然的下一步就是看新实例跑得怎样
      showCreateSuccess({
        title: t('jobDefinitionList.triggerSuccessTitle'),
        message: t('jobDefinitionList.triggerSuccessMessage', { code: row.jobCode }),
        primary: {
          label: t('jobDefinitionList.triggerSuccessPrimary'),
          onClick: () => goInstances(row.jobCode),
        },
        secondary: { label: t('jobDefinitionList.triggerSuccessSecondary') },
      })
    } finally {
      actingJobCode.value = ''
    }
  }

  async function cloneRow(row: ConsoleJobDefinitionResponse) {
    try {
      await ElMessageBox.confirm(
        t('jobDefinitionList.cloneConfirmText', { code: row.jobCode }),
        t('jobDefinitionList.cloneConfirmTitle'),
        {
          type: 'info',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      // 后端 clone @NotBlank 要求 newJobCode;默认在原 code 加 `-copy-<ts>` 后缀
      // 后续 BE 出"重名校验失败回 409"再补 retry 流程。
      const newJobCode = `${row.jobCode}-copy-${Date.now().toString(36).slice(-6)}`
      await jobApi.clone(row.id, row.tenantId || filters.tenantId || tenant.tenantId, newJobCode)
      ElMessage.success(t('jobDefinitionList.cloneSuccess', { code: row.jobCode }))
      await refetch()
    } catch {
      /* cancel */
    }
  }

  // ── Run-centric 详情抽屉(P2)─────
  const detailVisible = ref(false)
  const detailRow = ref<ConsoleJobDefinitionResponse | null>(null)
  const activeDetailTab = ref<'overview' | 'runs'>('overview')
  const detailRunsRows = ref<ConsoleJobInstanceResponse[]>([])
  const detailRunsLoading = ref(false)
  const detailRunsLoadedForJobCode = ref('')

  async function loadDetailRuns() {
    const def = detailRow.value
    if (!def?.jobCode || detailRunsLoadedForJobCode.value === def.jobCode) return
    detailRunsLoading.value = true
    try {
      const pageResult = await instanceApi.list({
        tenantId: def.tenantId ?? tenant.tenantId,
        jobCode: def.jobCode,
        page: 1,
        pageSize: 20,
      })
      detailRunsRows.value = pageResult.records ?? []
      detailRunsLoadedForJobCode.value = def.jobCode
    } catch {
      detailRunsRows.value = []
    } finally {
      detailRunsLoading.value = false
    }
  }

  function openDetail(row: ConsoleJobDefinitionResponse, initialTab: 'overview' | 'runs') {
    detailRow.value = row
    detailRunsRows.value = []
    detailRunsLoadedForJobCode.value = ''
    activeDetailTab.value = initialTab
    detailVisible.value = true
    if (initialTab === 'runs') void loadDetailRuns()
  }

  function goJobInstance(row: ConsoleJobInstanceResponse) {
    void router.push(`/monitor/job-instances/${row.id}`)
  }

  watch(activeDetailTab, (tab) => {
    if (tab === 'runs') void loadDetailRuns()
  })

  // ── 编辑抽屉(轻量版,只露 ExecutionMode + watermarkField,部分更新) ─────
  const editFormRef = ref<FormInstance>()
  const editDrawerVisible = ref(false)
  const editSaving = ref(false)
  const editingId = ref<number | null>(null)
  const editingTenantId = ref('')
  const editingJobCode = ref('')
  // Day 2 (A.1):editForm 从 2 字段(executionMode/watermarkField)扩到 24 字段,
  // 对齐 BE JobDefinitionUpdateRequest。所有可编辑字段均通过 JobConfigBasicForm 暴露。
  const editForm = reactive<JobEditFormState>(createEmptyJobEditForm())
  const createFormRef = ref<FormInstance>()
  const createDrawerVisible = ref(false)
  // 路由变化时自动关闭 detail / 编辑 / 新建 三个 drawer,避免跳到目标页 drawer 还罩着
  useDrawerAutoClose([detailVisible, editDrawerVisible, createDrawerVisible])
  const createSaving = ref(false)
  // jobType BE 枚举:GENERAL/IMPORT/EXPORT/PROCESS/DISPATCH/WORKFLOW(见 JobType.java)。
  // 此处默认 GENERAL,不能再用旧的 'SHELL'(早期遗留,BE 不认 → 400)。
  const createForm = reactive({
    jobCode: '',
    jobName: '',
    jobType: 'GENERAL',
    scheduleType: 'MANUAL',
    scheduleExpr: '',
    queueCode: '',
    workerGroup: '',
    executionMode: 'FULL' as ExecutionMode,
    watermarkField: '',
    enabled: true,
  })

  const { data: metaEnumsData } = useConsoleMetaEnumsQuery()
  const executionModeOptions = computed(() =>
    pickMetaEnumGroup(metaEnumsData.value, 'executionMode'),
  )

  /** 把 enum 值翻译为可读 label,优先 i18n key,缺则回退 BE label,再缺则原值。 */
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnumsData.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const editDrawerTitle = computed(() =>
    editingJobCode.value
      ? t('jobDefinitionList.drawerEditTitleWithCode', { code: editingJobCode.value })
      : t('jobDefinitionList.drawerEditTitle'),
  )

  const watermarkRule: FormItemRule = {
    validator: (_rule, value: unknown, callback) => {
      if (editForm.executionMode !== 'INCREMENTAL') return callback()
      const v = typeof value === 'string' ? value.trim() : ''
      if (!v) return callback(new Error(t('jobDefinitionList.ruleWatermarkRequired')))
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) {
        return callback(new Error(t('jobDefinitionList.ruleWatermarkPattern')))
      }
      return callback()
    },
    trigger: 'blur',
  }

  // Day 2 (A.1):编辑必填字段。BE 24 字段全 optional(partial update),
  // 但 UX 上 jobName / scheduleType / executionMode 三项空着无意义,在 FE 强制必填。
  // paramSchema / defaultParams 是 JSON 字符串,非空时必须语法合法,否则 BE 报 500。
  const jsonValidator = (
    _rule: unknown,
    value: string | undefined,
    callback: (err?: Error) => void,
  ) => {
    if (!value || !value.trim()) return callback()
    try {
      JSON.parse(value)
      callback()
    } catch {
      callback(new Error(t('jobConfigBasic.ruleInvalidJson')))
    }
  }
  const editFormRules: FormRules = {
    jobName: [rulesRequired(t('jobDefinitionList.ruleJobNameRequired'))],
    scheduleType: [rulesRequired(t('jobDefinitionList.ruleScheduleTypeRequired'))],
    executionMode: [
      {
        required: true,
        message: t('jobDefinitionList.ruleExecutionModeRequired'),
        trigger: 'change',
      },
    ],
    watermarkField: [watermarkRule],
    paramSchema: [{ validator: jsonValidator, trigger: 'blur' }],
    defaultParams: [{ validator: jsonValidator, trigger: 'blur' }],
  }
  // jobCode 格式:字母开头 + 字母/数字/下划线/连字符,长度 ≤ 128。
  // 不限制时用户可以输入 "q q q" 之类含空格,后端可入库但 URL 解码 / 路由会出错(空格跳转异常)。
  const JOB_CODE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/
  const jobCodePatternRule: FormItemRule = {
    validator: (_r, v: unknown, cb) => {
      const value = typeof v === 'string' ? v.trim() : ''
      if (!value) return cb()
      return JOB_CODE_PATTERN.test(value)
        ? cb()
        : cb(
            new Error(
              '字母开头,仅含字母/数字/下划线/连字符,长度 ≤ 128(不允许空格 / 中文 / 特殊符号)',
            ),
          )
    },
    trigger: 'blur',
  }
  const createFormRules: FormRules = {
    jobCode: [rulesRequired(t('jobDefinitionList.ruleJobCodeRequired')), jobCodePatternRule],
    jobType: [rulesRequired(t('jobDefinitionList.ruleJobTypeRequired'))],
    scheduleType: [rulesRequired(t('jobDefinitionList.ruleScheduleTypeRequired'))],
    watermarkField: [watermarkRule],
  }

  function rulesRequired(message: string): FormItemRule {
    return { required: true, message, trigger: ['blur', 'change'] }
  }

  // 切到 FULL/CDC 时自动清空水位字段
  watch(
    () => editForm.executionMode,
    (mode) => {
      if (mode !== 'INCREMENTAL') editForm.watermarkField = ''
    },
  )
  watch(
    () => createForm.executionMode,
    (mode) => {
      if (mode !== 'INCREMENTAL') createForm.watermarkField = ''
    },
  )

  function resetCreateForm() {
    createForm.jobCode = ''
    createForm.jobName = ''
    createForm.jobType = 'GENERAL'
    createForm.scheduleType = 'MANUAL'
    createForm.scheduleExpr = ''
    createForm.queueCode = ''
    createForm.workerGroup = ''
    createForm.executionMode = 'FULL'
    createForm.watermarkField = ''
    createForm.enabled = true
  }

  function openCreate() {
    resetCreateForm()
    createDrawerVisible.value = true
    void createFormRef.value?.clearValidate()
  }

  function closeCreateDrawer() {
    createDrawerVisible.value = false
  }

  function onCreateDrawerClose(done: () => void) {
    if (createSaving.value) return
    done()
  }

  async function submitCreate() {
    const valid = await createFormRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) createFormRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return
    createSaving.value = true
    try {
      await jobApi.createDefinition({
        tenantId: filters.tenantId || tenant.tenantId,
        jobCode: createForm.jobCode.trim(),
        jobName: createForm.jobName.trim() || undefined,
        jobType: createForm.jobType.trim(),
        scheduleType: createForm.scheduleType.trim(),
        scheduleExpr: createForm.scheduleExpr.trim() || undefined,
        queueCode: createForm.queueCode.trim() || undefined,
        workerGroup: createForm.workerGroup.trim() || undefined,
        executionMode: createForm.executionMode,
        watermarkField:
          createForm.executionMode === 'INCREMENTAL' ? createForm.watermarkField.trim() : '',
        enabled: createForm.enabled,
      })
      ElMessage.success(t('jobDefinitionList.createSuccess', { code: createForm.jobCode }))
      createDrawerVisible.value = false
      filters.jobCode = createForm.jobCode.trim()
      page.value = 1
      await refetch()
      void router.replace({
        query: { ...route.query, action: undefined, jobCode: filters.jobCode },
      })
    } finally {
      createSaving.value = false
    }
  }

  function openEdit(row: ConsoleJobDefinitionResponse) {
    editingId.value = row.id
    editingTenantId.value = row.tenantId || filters.tenantId || tenant.tenantId
    editingJobCode.value = row.jobCode
    // Day 2 (A.1):从 row 拷贝全量字段到 editForm,而非仅 2 字段
    Object.assign(editForm, jobResponseToEditForm(row))
    editDrawerVisible.value = true
    void editFormRef.value?.clearValidate()
  }

  function closeEditDrawer() {
    editDrawerVisible.value = false
  }

  function onEditDrawerClose(done: () => void) {
    if (editSaving.value) return
    done()
  }

  async function submitEdit() {
    if (editingId.value == null) return
    const valid = await editFormRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) editFormRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return
    editSaving.value = true
    try {
      // Day 2 (A.1):提交完整 24 字段(对齐 BE JobDefinitionUpdateRequest),
      // 不再仅传 executionMode + watermarkField。
      // jobCode / jobType 在 BE 视为不可改字段,这里不传。
      await jobApi.updateDefinition(editingId.value, {
        tenantId: editingTenantId.value,
        jobName: editForm.jobName.trim() || undefined,
        bizType: editForm.bizType.trim() || undefined,
        scheduleType: editForm.scheduleType || undefined,
        scheduleExpr: editForm.scheduleExpr.trim() || undefined,
        timezone: editForm.timezone.trim() || undefined,
        triggerMode: editForm.triggerMode.trim() || undefined,
        workerGroup: editForm.workerGroup.trim() || undefined,
        queueCode: editForm.queueCode || undefined,
        calendarCode: editForm.calendarCode.trim() || undefined,
        windowCode: editForm.windowCode.trim() || undefined,
        dagEnabled: editForm.dagEnabled,
        shardStrategy: editForm.shardStrategy.trim() || undefined,
        executionMode: editForm.executionMode,
        // 仅 INCREMENTAL 时回写值;其它模式回写空串让后端清字段
        watermarkField:
          editForm.executionMode === 'INCREMENTAL' ? editForm.watermarkField.trim() : '',
        retryPolicy: editForm.retryPolicy.trim() || undefined,
        retryMaxCount: editForm.retryMaxCount,
        timeoutSeconds: editForm.timeoutSeconds,
        executionHandler: editForm.executionHandler.trim() || undefined,
        paramSchema: editForm.paramSchema.trim() || undefined,
        defaultParams: editForm.defaultParams.trim() || undefined,
        priority: editForm.priority,
        enabled: editForm.enabled,
        description: editForm.description.trim() || undefined,
      })
      ElMessage.success(t('jobDefinitionList.updateSuccess', { code: editingJobCode.value }))
      editDrawerVisible.value = false
      await refetch()
    } finally {
      editSaving.value = false
    }
  }

  {
    const q = route.query
    if (q.jobCode) filters.jobCode = String(q.jobCode)
    if (q.action === 'create') {
      openCreate()
      void router.replace({ query: { ...route.query, action: undefined } })
    }
  }

  useTenantReload(loadMeta)
</script>

<style scoped>
  .detail-runs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }

  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  .queue-field {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .queue-field .el-select {
    flex: 1;
  }

  .definition-link {
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
  }

  .definition-link:hover {
    text-decoration: underline;
  }
</style>
