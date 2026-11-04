<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canTriggerWorkflows" @click="bulkTriggerVisible = true">
          {{ t('workflowDefinitionList.bulk.open') }}
        </el-button>
        <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="goCreate">
          {{ t('workflowDefinitionList.headerCreate') }}
        </el-button>
        <el-button v-if="canMutateConfig" @click="goDesignerNew">
          {{ t('workflowDefinitionList.headerDesigner') }}
        </el-button>
      </template>
    </PageHeader>

    <BulkActionBar :count="bulkSelection.count.value" @clear="bulkSelection.clear()">
      <el-button type="primary" :disabled="!canTriggerWorkflows" @click="bulkTriggerVisible = true">
        {{ t('workflowDefinitionList.bulk.open') }}
      </el-button>
    </BulkActionBar>
    <WorkflowBulkTriggerDialog
      v-model="bulkTriggerVisible"
      :tenant-id="tenant.tenantId"
      :can-trigger="canTriggerWorkflows"
      :targets="bulkSelection.selected.value"
    />

    <SectionCard>
      <ProTable
        ref="bulkTable"
        class="workflow-definition-table"
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
        :error="loadError"
        :on-retry="load"
        :has-active-filters="hasActiveFilters"
        table-layout="fixed"
        row-key="id"
        column-config-id="workflow-definitions"
        :column-defs="columnDefs"
        @selection-change="bulkSelection.onSelectionChange"
      >
        <template #toolbar>
          <OpsListToolbar
            :status="live.status.value"
            :last-refreshed-at="live.lastRefreshedAt.value"
          />
        </template>
        <template v-if="!hasActiveFilters" #empty>
          <EmptyState :description="t('workflowDefinitionList.emptyDescription')" :image-size="80">
            <template #action>
              <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="goCreate">
                {{ t('workflowDefinitionList.headerCreate') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('workflowDefinitionList.codeLabel')">
              <el-input
                class="query-w-240"
                v-model="filters.workflowCode"
                clearable
                :placeholder="t('workflowDefinitionList.codePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.nameLabel')">
              <el-input
                class="query-w-220"
                v-model="filters.workflowName"
                clearable
                :placeholder="t('workflowDefinitionList.namePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.enabledLabel')">
              <el-select
                class="query-w-120"
                v-model="filters.enabled"
                clearable
                :placeholder="t('workflowDefinitionList.enabledPlaceholder')"
              >
                <el-option :label="t('workflowDefinitionList.optEnabled')" :value="true" />
                <el-option :label="t('workflowDefinitionList.optDisabled')" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.typeLabel')">
              <MetaSelect
                class="query-w-160"
                v-model="filters.workflowType"
                :options="workflowTypeOptions"
                clearable
                filterable
                enum-key="workflowType"
                :placeholder="t('workflowDefinitionList.typePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.categoryLabel')">
              <el-select
                class="query-w-160"
                v-model="filters.singleJobWorkflow"
                clearable
                :placeholder="t('workflowDefinitionList.categoryPlaceholder')"
              >
                <el-option :label="t('workflowDefinitionList.optSingleJob')" :value="true" />
                <el-option :label="t('workflowDefinitionList.optComposed')" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.versionLabel')">
              <el-input-number
                class="query-w-140"
                v-model="filters.version"
                :min="1"
                :step="1"
                controls-position="right"
                :placeholder="t('workflowDefinitionList.versionPlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #default="{ isColVisible }">
          <el-table-column
            v-if="canTriggerWorkflows"
            type="selection"
            width="48"
            :selectable="
              (row: ConsoleWorkflowDefinitionResponse) =>
                row.enabled === true && row.tenantId === tenant.tenantId
            "
          />
          <el-table-column
            prop="workflowCode"
            :label="t('workflowDefinitionList.colCode')"
            width="150"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.workflowCode" :text="String(row.workflowCode)" />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="workflowName"
            :label="t('workflowDefinitionList.colName')"
            min-width="200"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.workflowName" :text="String(row.workflowName)" />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('workflowType')"
            prop="workflowType"
            :label="t('workflowDefinitionList.colType')"
            width="90"
          >
            <template #default="{ row }">
              {{ resolveEnumLabel('workflowType', row.workflowType) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('relation')"
            :label="t('workflowDefinitionList.colRelation')"
            width="110"
          >
            <template #default="{ row }">
              <el-tag size="small" :type="row.singleJobDefinitionId ? 'primary' : 'success'">
                {{
                  row.singleJobDefinitionId
                    ? t('workflowDefinitionList.singleJobWorkflow')
                    : t('workflowDefinitionList.composedWorkflow')
                }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('version')"
            prop="version"
            :label="t('workflowDefinitionList.colVersion')"
            width="64"
            align="right"
          />
          <el-table-column
            v-if="isColVisible('description')"
            prop="description"
            :label="t('workflowDefinitionList.colDescription')"
            min-width="160"
          >
            <template #default="{ row }">
              <CopyableText
                v-if="row.description"
                :text="decodeBasicEntities(row.description)"
                :copyable="false"
              />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('enabled')"
            prop="enabled"
            :label="t('workflowDefinitionList.colEnabled')"
            width="72"
          >
            <template #default="{ row }">
              <StatusTag :value="String(row.enabled)" category="yn" />
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('schedule')"
            :label="t('workflowDefinitionList.colSchedule')"
            width="96"
          >
            <template #default="{ row }">
              <StatusTag
                v-if="isScheduled(row as ConsoleWorkflowDefinitionResponse)"
                :value="String(row.scheduleEnabled !== false)"
                category="yn"
              />
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <DatetimeColumn
            v-if="isColVisible('updatedAt')"
            prop="updatedAt"
            :label="t('workflowDefinitionList.colUpdatedAt')"
            width="160"
          />
          <el-table-column
            :label="t('workflowDefinitionList.colActions')"
            width="240"
            fixed="right"
          >
            <template #default="{ row }">
              <RowActions
                :actions="rowActions(row as ConsoleWorkflowDefinitionResponse)"
                :inline-limit="2"
              />
            </template>
          </el-table-column>
        </template>
      </ProTable>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('workflowDefinitionList.detailTitle')"
      size="800px"
    >
      <el-tabs v-if="detailRow" v-model="activeDetailTab">
        <!-- Tab: 概览 -->
        <el-tab-pane name="overview" :label="t('workflowDefinitionList.detailTabOverview')">
          <el-descriptions :column="isMobile ? 1 : 2" border size="small">
            <el-descriptions-item :label="t('workflowDefinitionList.detailCode')">{{
              detailRow.workflowCode
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailName')">{{
              detailRow.workflowName
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailType')">{{
              resolveEnumLabel('workflowType', detailRow.workflowType)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailVersion')">{{
              detailRow.version
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailEnabled')">
              {{ detailRow.enabled ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('common.tenantId')">{{
              detailRow.tenantId
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('common.createdAt')">{{
              fmtDatetime(detailRow.createdAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('common.updatedAt')">{{
              fmtDatetime(detailRow.updatedAt)
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailNodes')">{{
              detailRow.nodes?.length ?? 0
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailEdges')">{{
              detailRow.edges?.length ?? 0
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="t('workflowDefinitionList.detailDescription')"
              :span="isMobile ? 1 : 2"
            >
              <JsonPreview :data="detailRow.description || '—'" />
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <!-- Tab: 最近运行(P2 Run-centric)-->
        <el-tab-pane name="runs" :lazy="true">
          <template #label>
            <span>
              {{ t('workflowDefinitionList.detailTabRuns') }}
              <el-tag v-if="detailRunsRows.length" size="small" round>{{
                detailRunsRows.length
              }}</el-tag>
            </span>
          </template>
          <el-table
            v-loading="detailRunsLoading"
            :data="detailRunsRows"
            size="small"
            empty-text="—"
            stripe
            @row-click="goWorkflowRun"
          >
            <el-table-column :label="t('runs.colRun')" min-width="90">
              <template #default="{ row }">
                <span class="cell-link">#{{ row.id }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('runs.colStatus')" width="110">
              <template #default="{ row }">
                <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
              </template>
            </el-table-column>
            <el-table-column prop="bizDate" :label="t('runs.colBizDate')" width="110" />
            <el-table-column
              prop="currentNodeCode"
              :label="t('runs.colCurrentNode')"
              min-width="140"
            >
              <template #default="{ row }">
                <CopyableText
                  v-if="row.currentNodeCode"
                  :text="String(row.currentNodeCode)"
                  @click.stop
                />
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column :label="t('runs.colStarted')" width="160">
              <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- Tab: DAG 预览(只读迷你图,要交互去 /workflow/viewer/{id})-->
        <el-tab-pane name="dag" :lazy="true">
          <template #label>
            <span>{{ t('workflowDefinitionList.detailTabDag') }}</span>
          </template>
          <WorkflowMiniDag
            :mermaid-text="detailMermaidText"
            :loading="detailMermaidLoading"
            :error-message="detailMermaidError"
            :empty-text="t('workflowDefinitionList.dagPreviewEmpty')"
            :max-height="360"
          >
            <template #footer>
              <el-button text type="primary" @click="openFullDag">
                {{ t('workflowDefinitionList.dagPreviewOpen') }}
              </el-button>
            </template>
          </WorkflowMiniDag>
        </el-tab-pane>

        <!-- Tab: DSL(节点 + 边的 JSON)-->
        <el-tab-pane name="dsl" :label="t('workflowDefinitionList.detailTabDsl')">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item :label="t('workflowDefinitionList.detailNodes')">
              <JsonPreview :data="detailRow.nodes ?? []" />
            </el-descriptions-item>
            <el-descriptions-item :label="t('workflowDefinitionList.detailEdges')">
              <JsonPreview :data="detailRow.edges ?? []" />
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <WorkflowTriggerDialog
      v-model="triggerVisible"
      v-model:biz-date="triggerBizDate"
      :busy="triggerBusy"
      @submit="submitTrigger"
    />

    <el-dialog
      v-model="validateVisible"
      :title="t('workflowDefinitionList.validateTitle')"
      width="min(760px, calc(100% - 32px))"
    >
      <div v-if="validateResult" class="validate-result">
        <el-alert
          :type="validateResult.valid ? 'success' : 'error'"
          :title="
            validateResult.valid
              ? t('workflowDefinitionList.validatePass')
              : t('workflowDefinitionList.validateFailed', {
                  errors: validateErrorCount,
                  warnings: validateWarningCount,
                })
          "
          show-icon
          :closable="false"
        />
        <el-table
          v-if="validateResult.findings.length"
          :data="validateResult.findings"
          stripe
          border
          size="small"
          class="validate-result__table console-table"
        >
          <el-table-column :label="t('workflowDefinitionList.validateColLevel')" width="100">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.level === 'ERROR' ? 'danger' : 'warning'"
                effect="plain"
              >
                {{ resolveEnumLabel('severity', row.level) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="code"
            :label="t('workflowDefinitionList.validateColCode')"
            width="170"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.code" :text="String(row.code)" />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('workflowDefinitionList.validateColTarget')" width="160">
            <template #default="{ row }">
              <CopyableText v-if="row.nodeCode" :text="String(row.nodeCode)">
                {{ t('workflowDefinitionList.validateTargetNode') }}: {{ row.nodeCode }}
              </CopyableText>
              <CopyableText v-else-if="row.edgeId" :text="String(row.edgeId)">
                {{ t('workflowDefinitionList.validateTargetEdge') }}: {{ row.edgeId }}
              </CopyableText>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="message"
            :label="t('workflowDefinitionList.validateColMessage')"
            min-width="260"
          >
            <template #default="{ row }">
              <CopyableText v-if="row.message" :text="String(row.message)" :copyable="false" />
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { isScheduled } from '@/utils/workflowScheduleValidation'
  import WorkflowTriggerDialog from './WorkflowTriggerDialog.vue'
  import { computed, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { useResponsive } from '@/composables/useResponsive'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Plus } from '@lucide/vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'

  const { t, te } = useI18n({ useScope: 'global' })

  // 列设置：可视区放不下全部列，类型（多为 DAG）与更新时间默认隐藏，可在“列设置”中打开
  const columnDefs = computed(() => [
    { key: 'workflowType', label: t('workflowDefinitionList.colType'), defaultHidden: true },
    { key: 'relation', label: t('workflowDefinitionList.colRelation') },
    { key: 'version', label: t('workflowDefinitionList.colVersion') },
    { key: 'description', label: t('workflowDefinitionList.colDescription') },
    { key: 'enabled', label: t('workflowDefinitionList.colEnabled') },
    { key: 'schedule', label: t('workflowDefinitionList.colSchedule') },
    { key: 'updatedAt', label: t('workflowDefinitionList.colUpdatedAt'), defaultHidden: true },
  ])

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { usePermission } from '@/composables/usePermission'
  import { workflowApi, type DagValidationResult } from '@/api/workflow'
  import { instanceApi } from '@/api/instance'
  import { fmtDatetime } from '@/utils/datetime'
  import { decodeBasicEntities } from '@/utils/text'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useJobCodeOptions } from '@/composables/useJobCodeOptions'
  import { useBulkSelection } from '@/composables/useBulkSelection'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import WorkflowBulkTriggerDialog from '@/components/workflow/WorkflowBulkTriggerDialog.vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import WorkflowMiniDag from '@/components/workflow/WorkflowMiniDag.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import type {
    ConsoleWorkflowDefinitionResponse,
    ConsoleWorkflowRunResponse,
    WorkflowDefinitionDetailResponse,
  } from '@/types/console-api'

  const router = useRouter()
  const { isMobile } = useResponsive()
  const tenant = useTenantStore()
  // VIEWER 角色 toggle/archive 都属于破坏性,行内按钮需要灰显 + tooltip,而不是点了才弹 403
  const { canMutateConfig, canAccess } = usePermission()
  const canTriggerWorkflows = computed(() => canAccess('OPERATOR'))
  const bulkSelection = useBulkSelection<ConsoleWorkflowDefinitionResponse>()
  const bulkTable = ref<InstanceType<typeof ProTable> | null>(null)
  watch(bulkTable, (table) => bulkSelection.bindTable(table))
  const bulkTriggerVisible = ref(false)

  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const actingIds = ref<Set<number>>(new Set())

  function removeActingId(id: number) {
    actingIds.value = new Set([...actingIds.value].filter((actingId) => actingId !== id))
  }

  const triggerVisible = ref(false)
  const triggerBusy = ref(false)
  const triggerTarget = ref<ConsoleWorkflowDefinitionResponse | null>(null)
  const triggerBizDate = ref('')

  const detailVisible = ref(false)
  const detailRow = ref<WorkflowDefinitionDetailResponse | null>(null)
  const activeDetailTab = ref<'overview' | 'runs' | 'dag' | 'dsl'>('overview')
  const detailMermaidText = ref('')
  const detailMermaidLoading = ref(false)
  const detailMermaidError = ref('')
  const detailMermaidLoadedForId = ref<number | null>(null)

  async function loadDetailMermaid() {
    const def = detailRow.value
    if (!def?.id || detailMermaidLoadedForId.value === def.id) return
    detailMermaidLoading.value = true
    detailMermaidError.value = ''
    try {
      const mer = await workflowApi.mermaid(def.id, def.tenantId ?? tenant.tenantId)
      detailMermaidText.value = mer.mermaid ?? ''
      detailMermaidLoadedForId.value = def.id
    } catch (err: unknown) {
      detailMermaidText.value = ''
      detailMermaidError.value = userErrorMessage(err)
    } finally {
      detailMermaidLoading.value = false
    }
  }

  function openFullDag() {
    const def = detailRow.value
    if (!def?.id) return
    detailVisible.value = false
    void router.push(`/workflow/viewer/${def.id}`)
  }
  const detailRunsRows = ref<ConsoleWorkflowRunResponse[]>([])
  const detailRunsLoading = ref(false)
  const detailRunsLoadedForId = ref<number | null>(null)

  async function loadDetailRuns() {
    const def = detailRow.value
    if (!def?.id || detailRunsLoadedForId.value === def.id) return
    detailRunsLoading.value = true
    try {
      const page = await instanceApi.workflowRuns({
        tenantId: def.tenantId ?? tenant.tenantId,
        workflowDefinitionId: def.id,
        page: 1,
        pageSize: 15,
      })
      detailRunsRows.value = page.records ?? []
      detailRunsLoadedForId.value = def.id
    } catch {
      detailRunsRows.value = []
    } finally {
      detailRunsLoading.value = false
    }
  }

  function goWorkflowRun(row: ConsoleWorkflowRunResponse) {
    void router.push(`/monitor/workflow-runs/${row.id}`)
  }
  const validateVisible = ref(false)
  useDrawerAutoClose([detailVisible, validateVisible])
  const validateResult = ref<DagValidationResult | null>(null)
  const validateErrorCount = computed(
    () =>
      validateResult.value?.findings?.filter((f: { level: string }) => f.level === 'ERROR')
        .length ?? 0,
  )
  const validateWarningCount = computed(
    () =>
      validateResult.value?.findings?.filter((f: { level: string }) => f.level === 'WARNING')
        .length ?? 0,
  )
  const filters = reactive({
    tenantId: tenant.tenantId,
    workflowCode: '',
    workflowName: '',
    enabled: undefined as boolean | undefined,
    workflowType: '',
    singleJobWorkflow: undefined as boolean | undefined,
    version: undefined as number | undefined,
  })
  const hasActiveFilters = computed(
    () =>
      !!(
        filters.workflowCode.trim() ||
        filters.workflowName.trim() ||
        filters.enabled !== undefined ||
        filters.workflowType.trim() ||
        filters.singleJobWorkflow !== undefined ||
        filters.version != null
      ),
  )

  // workflowType 走后端 enum；候选不依赖列表全量加载。
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const workflowTypeOptions = computed(() => {
    const fromEnum = pickMetaEnumGroup(metaEnums.value, 'workflowType')
    if (fromEnum.length > 0) return fromEnum
    return []
  })
  function openDag(row: ConsoleWorkflowDefinitionResponse) {
    void router.push({ path: `/workflow/viewer/${row.id}` })
  }

  /** 新建走配置包 Excel 导入向导(workflow_definition/node/edge 3 个 sheet 在同包内) */
  function goCreate() {
    if (!canMutateConfig.value) return
    void router.push({ path: '/config/tenant-package' })
  }

  /** 新建走 DAG 设计器,保留 Excel 导入路径不动 */
  function goDesignerNew() {
    if (!canMutateConfig.value) return
    void router.push({ path: '/workflow/designer' })
  }

  function openInDesigner(row: ConsoleWorkflowDefinitionResponse) {
    void router.push({ path: `/workflow/designer/${row.id}` })
  }

  /**
   * 按 row 状态组合行操作。
   * - "DAG" 是主操作,直显
   * - "校验" / "详情" 直显(次要)
   * - "启用"/"停用" 折进 More
   * - "归档" 折进 More + danger(实际只是禁用,BE 无物理删,文案要诚实)
   */
  function rowActions(row: ConsoleWorkflowDefinitionResponse): RowAction[] {
    return [
      {
        key: 'dag',
        label: t('workflowDefinitionList.actionDag'),
        primary: true,
        onClick: () => openDag(row),
      },
      ...(!row.singleJobDefinitionId
        ? [
            {
              key: 'designer',
              label: t('workflowDefinitionList.actionOpenInDesigner'),
              onClick: () => openInDesigner(row),
            } as RowAction,
          ]
        : []),
      ...(row.singleJobDefinitionId
        ? [
            {
              key: 'job-definition',
              label: t('workflowDefinitionList.actionJobDefinition'),
              onClick: () => router.push(`/jobs/definitions/${row.singleJobDefinitionId}`),
            } as RowAction,
          ]
        : []),
      {
        key: 'trigger',
        label: t('workflowDefinitionList.actionTrigger'),
        disabled: !row.enabled || !canTriggerWorkflows.value,
        loading: triggerBusy.value && triggerTarget.value?.id === row.id,
        onClick: () => openTrigger(row),
      },
      // 有历史版本才提供版本对比入口；目标和起始版本在比较页中从后端目录选择。
      ...(row.version >= 2
        ? [
            {
              key: 'version-diff',
              label: t('workflowDesignerPolish.diffViewerTitle'),
              onClick: () =>
                router.push({
                  path: `/workflow/designer/${row.id}/diff/${row.version - 1}/${row.version}`,
                }),
            } as RowAction,
          ]
        : []),
      {
        key: 'validate',
        label: t('workflowDefinitionList.actionValidate'),
        loading: actingIds.value.has(row.id),
        onClick: () => validateRow(row),
      },
      {
        key: 'detail',
        label: t('workflowDefinitionList.actionDetail'),
        onClick: () => openDetail(row),
      },
      {
        key: 'toggle',
        // VIEWER 角色看不写权限时,行内按钮通过 disabled 灰显(RowActions 已有 disabled 渲染样式),
        // label 后缀 *(无权限)* 让用户秒懂(避免 tooltip 在 dropdown 项里实现复杂)。
        label: row.enabled
          ? t('workflowDefinitionList.actionDisable')
          : t('workflowDefinitionList.actionEnable'),
        loading: actingIds.value.has(row.id),
        disabled: !canMutateConfig.value,
        onClick: () => toggleRow(row),
      },
      ...(isScheduled(row)
        ? [
            {
              key: 'schedule-toggle',
              label:
                row.scheduleEnabled === false
                  ? t('workflowDefinitionList.actionResumeSchedule')
                  : t('workflowDefinitionList.actionPauseSchedule'),
              disabled: !canMutateConfig.value,
              loading: actingIds.value.has(row.id),
              onClick: () => toggleScheduleRow(row),
            } as RowAction,
          ]
        : []),
      ...(!row.singleJobDefinitionId
        ? [
            {
              key: 'archive',
              label: t('workflowDefinitionList.actionArchive'),
              danger: true,
              divided: true,
              // 已禁用的不再让点 + VIEWER 无写权限
              disabled: !row.enabled || !canMutateConfig.value,
              loading: actingIds.value.has(row.id),
              onClick: () => removeRow(row),
            } as RowAction,
          ]
        : []),
    ]
  }

  async function toggleScheduleRow(row: ConsoleWorkflowDefinitionResponse) {
    if (!canMutateConfig.value || !isScheduled(row)) return
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      const enabled = row.scheduleEnabled === false
      await workflowApi.toggleSchedule(row.id, row.tenantId ?? tenant.tenantId, enabled)
      ElMessage.success(
        t(
          enabled
            ? 'workflowDefinitionList.scheduleResumed'
            : 'workflowDefinitionList.schedulePaused',
        ),
      )
      await load()
    } catch (err: unknown) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      removeActingId(row.id)
    }
  }

  function openTrigger(row: ConsoleWorkflowDefinitionResponse) {
    if (!row.enabled) return
    triggerTarget.value = row
    const today = new Date()
    const year = today.getFullYear()
    const monthText = String(today.getMonth() + 1).padStart(2, '0')
    const dayText = String(today.getDate()).padStart(2, '0')
    triggerBizDate.value = [year, monthText, dayText].join('-')
    triggerVisible.value = true
  }

  async function submitTrigger() {
    const target = triggerTarget.value
    if (!target || !triggerBizDate.value || triggerBusy.value) return
    triggerBusy.value = true
    try {
      const runId = await workflowApi.trigger(target.id, {
        tenantId: target.tenantId ?? tenant.tenantId,
        bizDate: triggerBizDate.value,
        triggerType: 'MANUAL',
      })
      triggerVisible.value = false
      ElMessage.success(t('workflowDefinitionList.triggerAccepted'))
      const numericRunId = Number(runId)
      if (Number.isSafeInteger(numericRunId) && numericRunId > 0) {
        await router.push(`/monitor/workflow-runs/${numericRunId}`)
      } else {
        await load()
      }
    } catch (err: unknown) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      triggerBusy.value = false
    }
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const result = await workflowApi.listDefinitions({
        tenantId: filters.tenantId || tenant.tenantId,
        workflowCode: filters.workflowCode.trim() || undefined,
        workflowName: filters.workflowName.trim() || undefined,
        enabled: filters.enabled,
        workflowType: filters.workflowType.trim() || undefined,
        singleJobWorkflow: filters.singleJobWorkflow,
        version: filters.version,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = result.records
      total.value = result.total
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
      live.markRefreshed()
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
      filters.tenantId = tenant.tenantId
      filters.workflowCode = ''
      filters.workflowName = ''
      filters.enabled = undefined
      filters.workflowType = ''
      filters.singleJobWorkflow = undefined
      filters.version = undefined
      page.value = 1
      await load()
    })
  }

  async function openDetail(row: ConsoleWorkflowDefinitionResponse) {
    // 用 row.tenantId 而非 tenant.tenantId,避免租户切换 race 时跨租户 404
    // (BE 防跨租户泄漏,row 来自 ta 但 store 已切 tb → 用 tb 查 ta 的 id → 404)
    detailRow.value = await workflowApi.detailById(row.id, row.tenantId ?? tenant.tenantId)
    // 切到新的定义时重置 runs 缓存,避免显示上一次的 runs
    detailRunsRows.value = []
    detailRunsLoadedForId.value = null
    detailMermaidText.value = ''
    detailMermaidError.value = ''
    detailMermaidLoadedForId.value = null
    activeDetailTab.value = 'overview'
    detailVisible.value = true
  }

  watch(activeDetailTab, (tab) => {
    if (tab === 'runs') void loadDetailRuns()
    if (tab === 'dag') void loadDetailMermaid()
  })

  async function toggleRow(row: ConsoleWorkflowDefinitionResponse) {
    try {
      const action = row.enabled
        ? t('workflowDefinitionList.actionDisable')
        : t('workflowDefinitionList.actionEnable')
      await confirmDanger({
        verb: t('workflowDefinitionList.toggleConfirmTitle'),
        target: '',
        consequence: t('workflowDefinitionList.toggleConfirmText', {
          action,
          code: row.workflowCode,
        }),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return
    }
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      await workflowApi.toggle(row.id, row.tenantId ?? tenant.tenantId, !row.enabled)
      const action = row.enabled
        ? t('workflowDefinitionList.actionDisable')
        : t('workflowDefinitionList.actionEnable')
      ElMessage.success(
        t('workflowDefinitionList.toggleSuccess', { action, code: row.workflowCode }),
      )
      await load()
    } finally {
      removeActingId(row.id)
    }
  }

  async function validateRow(row: ConsoleWorkflowDefinitionResponse) {
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      const result = await workflowApi.validate(row.id, row.tenantId ?? tenant.tenantId)
      validateResult.value = result ?? null
      validateVisible.value = true
    } finally {
      removeActingId(row.id)
    }
  }

  async function removeRow(row: ConsoleWorkflowDefinitionResponse) {
    try {
      await confirmDanger({
        verb: t('workflowDefinitionList.archiveVerb'),
        target: t('workflowDefinitionList.archiveTarget', { code: row.workflowCode }),
        // 诚实告知:这是软归档(BE 不暴露物理删除接口),实际走 toggle 禁用,可恢复
        consequence: t('workflowDefinitionList.archiveConsequence'),
        irreversible: false,
      })
    } catch {
      return
    }
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      await workflowApi.toggle(row.id, row.tenantId ?? tenant.tenantId, false)
      ElMessage.success(t('workflowDefinitionList.archiveSuccess', { code: row.workflowCode }))
      if (rows.value.length === 1 && page.value > 1) {
        page.value -= 1
      }
      await load()
    } finally {
      removeActingId(row.id)
    }
  }

  const live = useSseAutoReload({
    domain: 'workflow-definitions',
    reload: load,
    scope: () => tenant.tenantId,
  })

  useTenantReload(() => {
    bulkSelection.clear()
    page.value = 1
    void load()
  })
</script>

<style scoped src="./WorkflowDefinitionList.css"></style>
