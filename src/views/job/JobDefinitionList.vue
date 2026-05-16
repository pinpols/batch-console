<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
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
              <el-button type="primary" @click="$router.push('/config/tenant-package')">
                {{ t('jobDefinitionList.emptyGoImport') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <el-table-column prop="jobCode" :label="t('jobDefinitionList.colJobCode')" width="220">
          <template #default="{ row }">
            <CopyableText :text="row.jobCode" />
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
        <el-form-item :label="t('jobDefinitionList.fieldScheduleExpr')" prop="scheduleExpr">
          <el-input
            v-model="createForm.scheduleExpr"
            :placeholder="t('jobDefinitionList.createScheduleExprPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.queueLabel')" prop="queueCode">
          <MetaSelect
            v-model="createForm.queueCode"
            class="query-w-full"
            clearable
            filterable
            :placeholder="t('jobDefinitionList.queuePlaceholder')"
            :options="queueOptions"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.workerGroupLabel')" prop="workerGroup">
          <el-input
            v-model="createForm.workerGroup"
            :placeholder="t('jobDefinitionList.workerGroupPlaceholder')"
          />
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
      v-model="editDrawerVisible"
      :title="editDrawerTitle"
      size="480px"
      :before-close="onEditDrawerClose"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-width="120px"
        @submit.prevent
      >
        <el-form-item :label="t('jobDefinitionList.fieldJobCode')">
          <el-input :model-value="editingJobCode" disabled />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.fieldExecutionMode')" prop="executionMode">
          <MetaSelect
            v-model="editForm.executionMode"
            class="query-w-full"
            enum-key="executionMode"
            :options="executionModeOptions"
          />
        </el-form-item>
        <el-form-item
          v-if="editForm.executionMode === 'INCREMENTAL'"
          :label="t('jobDefinitionList.fieldWatermark')"
          prop="watermarkField"
        >
          <el-input
            v-model="editForm.watermarkField"
            :placeholder="t('jobDefinitionList.fieldWatermarkPlaceholder')"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>
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
      v-model="detailVisible"
      :title="t('jobDefinitionList.detailTitle', { code: detailRow?.jobCode || '' })"
      size="720px"
    >
      <el-tabs v-if="detailRow" v-model="activeDetailTab">
        <el-tab-pane name="overview" :label="t('jobDefinitionList.detailTabOverview')">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="jobCode">{{ detailRow.jobCode }}</el-descriptions-item>
            <el-descriptions-item label="jobName">{{ detailRow.jobName }}</el-descriptions-item>
            <el-descriptions-item label="jobType">{{ detailRow.jobType }}</el-descriptions-item>
            <el-descriptions-item label="enabled">
              {{ detailRow.enabled ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item label="executionMode">
              {{ resolveEnumLabel('executionMode', detailRow.executionMode) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="detailRow.watermarkField" label="watermarkField">
              {{ detailRow.watermarkField }}
            </el-descriptions-item>
            <el-descriptions-item label="queueCode">{{
              detailRow.queueCode || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="workerGroup">{{
              detailRow.workerGroup || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="scheduleType">{{
              detailRow.scheduleType || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="scheduleExpr">{{
              detailRow.scheduleExpr || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="retryPolicy">{{
              detailRow.retryPolicy || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="retryMaxCount">{{
              detailRow.retryMaxCount
            }}</el-descriptions-item>
            <el-descriptions-item label="timeoutSeconds">{{
              detailRow.timeoutSeconds
            }}</el-descriptions-item>
            <el-descriptions-item label="createdAt">{{
              detailRow.createdAt || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="updatedAt">{{
              detailRow.updatedAt || '—'
            }}</el-descriptions-item>
          </el-descriptions>
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
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
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
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useJobDefinitionsPaged } from '@/composables/queries/useJobDefinitionsPaged'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { showCreateSuccess } from '@/composables/useCreateSuccess'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import type {
    ConsoleJobDefinitionResponse,
    ConsoleJobInstanceResponse,
  } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const page = ref(1)
  const pageSize = ref(20)
  const actingJobCode = ref('')
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
      const { value } = await ElMessageBox.prompt(
        t('jobDefinitionList.triggerPrompt'),
        t('jobDefinitionList.triggerTitle', { code: row.jobCode }),
        {
          inputType: 'textarea',
          inputValue: '{}',
          confirmButtonText: t('jobDefinitionList.triggerConfirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      payloadText = value?.trim() || '{}'
      JSON.parse(payloadText)
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
  const editForm = reactive<{ executionMode: ExecutionMode; watermarkField: string }>({
    executionMode: 'FULL',
    watermarkField: '',
  })
  const createFormRef = ref<FormInstance>()
  const createDrawerVisible = ref(false)
  const createSaving = ref(false)
  const createForm = reactive({
    jobCode: '',
    jobName: '',
    jobType: 'SHELL',
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

  const editFormRules: FormRules = {
    executionMode: [
      {
        required: true,
        message: t('jobDefinitionList.ruleExecutionModeRequired'),
        trigger: 'change',
      },
    ],
    watermarkField: [watermarkRule],
  }
  const createFormRules: FormRules = {
    jobCode: [rulesRequired(t('jobDefinitionList.ruleJobCodeRequired'))],
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
    createForm.jobType = 'SHELL'
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
    editForm.executionMode = (row.executionMode as ExecutionMode | undefined) || 'FULL'
    editForm.watermarkField = row.watermarkField ?? ''
    editDrawerVisible.value = true
    // 抽屉打开后清掉历史校验态
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
      await jobApi.updateDefinition(editingId.value, {
        tenantId: editingTenantId.value,
        executionMode: editForm.executionMode,
        // 仅 INCREMENTAL 时回写值;其它模式回写空串让后端清字段
        watermarkField:
          editForm.executionMode === 'INCREMENTAL' ? editForm.watermarkField.trim() : '',
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
</style>
