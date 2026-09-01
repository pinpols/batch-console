<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <div class="job-header-actions">
          <el-tooltip
            :content="
              canMutateConfig
                ? t('jobDefinitionList.headerWizardTip')
                : t('common.permissionDenied')
            "
            placement="top"
          >
            <span>
              <!-- 照设计 proto-jobs_view:向导新建 / Bundle 导入 = 无图标 ghost 按钮 -->
              <el-button :disabled="!canMutateConfig" @click="router.push('/jobs/definitions/new')">
                {{ t('jobDefinitionList.headerWizard') }}
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip
            :content="
              canMutateConfig
                ? t('jobDefinitionList.headerBundleTip')
                : t('common.permissionDenied')
            "
            placement="top"
          >
            <span>
              <el-button :disabled="!canMutateConfig" @click="openBundleImport">
                {{ t('jobDefinitionList.headerBundle') }}
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip
            :content="
              canMutateConfig
                ? t('jobDefinitionList.headerCreateTip')
                : t('common.permissionDenied')
            "
            placement="top"
          >
            <span>
              <el-button
                type="primary"
                :icon="Plus"
                :disabled="!canMutateConfig"
                @click="openCreate"
              >
                {{ t('jobDefinitionList.headerCreate') }}
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        class="job-definition-table"
        :data="filtered"
        :loading="tableBlocking"
        :error="jobLoadError"
        :on-retry="
          () => {
            void refetch()
          }
        "
        :total="total"
        column-config-id="job-definitions"
        :column-defs="columnDefs"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="() => {}"
        table-layout="fixed"
      >
        <template #query>
          <ListPageQueryBar
            :cols="4"
            :model="filters"
            :filter-busy="queryActionBusy"
            :refresh-busy="isFetching"
            :disabled="isPending"
            :show-refresh="false"
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

        <template #default="{ isColVisible }">
          <!-- 列序照设计 proto-jobs_view:JOB CODE(250) 名称 类型 WORKER GROUP QUEUE 启用 操作 -->
          <el-table-column prop="jobCode" :label="t('jobDefinitionList.colJobCode')" width="210">
            <template #default="{ row }">
              <router-link class="definition-link" :to="definitionDetailLocation(row)">
                {{ row.jobCode }}
              </router-link>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('jobName')"
            prop="jobName"
            :label="t('jobDefinitionList.colJobName')"
            min-width="190"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColVisible('jobType')"
            prop="jobType"
            :label="t('jobDefinitionList.colJobType')"
            width="100"
          >
            <template #default="{ row }">
              <!-- 照设计:类型 = mono 彩底 pill(ATOMIC 紫 / PROCESS 蓝 / IMPORT 青 / EXPORT 琥珀),值为原枚举码 -->
              <span class="jd-type-pill" :style="jobTypePillStyle(row.jobType || 'GENERAL')">
                {{ row.jobType || 'GENERAL' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('tenantId')"
            prop="tenantId"
            :label="t('jobDefinitionList.colTenant')"
            width="140"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColVisible('workerGroup')"
            prop="workerGroup"
            :label="t('jobDefinitionList.colWorkerGroup')"
            width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="jd-cell-sub">{{ row.workerGroup || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('queueCode')"
            prop="queueCode"
            :label="t('jobDefinitionList.colQueue')"
            width="130"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="jd-cell-sub jd-cell-mono">{{ row.queueCode || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('scheduleType')"
            prop="scheduleType"
            :label="t('jobDefinitionList.colScheduleType')"
            width="120"
          >
            <template #default="{ row }">
              {{ resolveScheduleType(row.scheduleType) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('executionMode')"
            prop="executionMode"
            :label="t('jobDefinitionList.colExecutionMode')"
            width="110"
          >
            <template #default="{ row }">
              <StatusTag :value="row.executionMode || 'FULL'" category="executionMode" />
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('enabled')"
            prop="enabled"
            :label="t('jobDefinitionList.colEnabled')"
            width="70"
          >
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                size="small"
                :disabled="!canMutateConfig"
                :loading="actingJobCode === row.jobCode"
                @change="() => toggleRow(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColVisible('scheduleExpr')"
            prop="scheduleExpr"
            :label="t('jobDefinitionList.colScheduleExpr')"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column :label="t('jobDefinitionList.colActions')" width="190" fixed="right">
            <template #default="{ row }">
              <RowActions :actions="rowActions(row)" :inline-limit="2" />
            </template>
          </el-table-column>
        </template>
      </ProTable>
    </SectionCard>

    <!--
      设计 560px 右侧抽屉三态(查看/编辑/新建):
      docs/redesign/proto-jobs_view.html / proto-jobs_edit.html / proto-jobs_create.html。
      查看↔编辑可切换;业务逻辑/校验/API/权限全部平移自原三个 el-drawer。
    -->
    <JobDefinitionDrawer
      :visible="jdVisible"
      :mode="jdMode"
      :head-label="t('jobDefinitionList.jdDrawerKindLabel')"
      :title="jdTitle"
      :pill="jdPill"
      :saving="jdMode === 'create' ? createSaving : editSaving"
      :save-label="
        jdMode === 'create'
          ? t('jobDefinitionList.drawerCreateSubmit')
          : t('jobDefinitionList.drawerSave')
      "
      :exporting="!!detailRow && exportingJobCode === detailRow.jobCode"
      :can-edit="canMutateConfig"
      @close="onJdClose"
      @cancel="onJdCancel"
      @save="onJdSave"
      @edit="onJdEdit"
      @export="onJdExport"
    >
      <!-- 查看态:分区字段块(label 上置)+ 关联文件 + 最近运行 -->
      <template v-if="jdMode === 'view' && detailRow">
        <section v-for="group in viewGroups" :key="group.title" class="jd-section">
          <div class="jd-section__label">{{ group.title }}</div>
          <div class="jd-grid">
            <div
              v-for="field in group.fields"
              :key="field.label"
              class="jd-field"
              :class="{ 'jd-field--wide': field.wide }"
            >
              <div class="jd-field__label">{{ field.label }}</div>
              <pre v-if="field.json" class="jd-field__json">{{ field.value }}</pre>
              <div v-else class="jd-field__value" :class="{ 'is-mono': field.mono }">
                {{ field.value }}
              </div>
            </div>
          </div>
        </section>

        <section class="jd-section">
          <div class="jd-section__label">{{ t('jobDefinitionList.detailTabRelatedFiles') }}</div>
          <JobRelatedFilesTab
            v-if="detailRow.jobType === 'IMPORT' || detailRow.jobType === 'EXPORT'"
            :tenant-id="detailRow.tenantId"
            :job-code="detailRow.jobCode"
          />
          <el-empty
            v-else
            :description="t('jobDefinitionList.fileTabNotApplicable')"
            :image-size="60"
          />
        </section>

        <section class="jd-section">
          <div class="jd-section__label">
            {{ t('jobDefinitionList.detailTabRuns') }}
            <el-tag v-if="detailRunsRows.length" size="small" round>{{
              detailRunsRows.length
            }}</el-tag>
          </div>
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
        </section>
      </template>

      <!--
        编辑态。Day 2 (A.1):编辑表单 2 字段扩到 24 字段,对齐 BE JobDefinitionUpdateRequest。
        表单内容抽在 <JobConfigBasicForm> 组件,与新建向导共用。
      -->
      <el-form
        v-else-if="jdMode === 'edit'"
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-position="top"
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
      </el-form>

      <!-- 新建态 -->
      <el-form
        v-else
        ref="createFormRef"
        :model="createForm"
        :rules="createFormRules"
        label-position="top"
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
        <el-form-item
          v-if="createForm.scheduleType !== 'MANUAL'"
          :label="t('jobConfigBasic.fieldDependsOnJobCode')"
          prop="dependsOnJobCode"
        >
          <el-input
            v-model="createForm.dependsOnJobCode"
            clearable
            maxlength="128"
            show-word-limit
            :placeholder="t('jobConfigBasic.placeholderDependsOnJobCode')"
          />
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
                  : t('jobDefinitionList.queueEmptyPlaceholder')
              "
              :options="queueOptions"
            />
            <el-button
              v-if="!queueOptions.length"
              link
              type="primary"
              @click="router.push('/governance/queues')"
            >
              {{ t('jobDefinitionList.queueGoCreate') }}
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
      </el-form>
    </JobDefinitionDrawer>

    <el-dialog
      v-model="bundleImportVisible"
      :title="t('jobDefinitionList.bundleImportTitle')"
      width="640px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item :label="t('jobDefinitionList.bundleImportTargetLabel')">
          <el-select
            v-model="bundleImportTargets"
            multiple
            filterable
            allow-create
            default-first-option
            :placeholder="t('jobDefinitionList.bundleImportTargetPlaceholder')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.bundleImportModeLabel')">
          <el-radio-group v-model="bundleImportMode">
            <el-radio value="UPSERT">{{ t('jobDefinitionList.bundleImportModeUpsert') }}</el-radio>
            <el-radio value="SKIP_EXISTING">{{
              t('jobDefinitionList.bundleImportModeSkip')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="bundleImportDryRun">{{
            t('jobDefinitionList.bundleImportDryRun')
          }}</el-checkbox>
        </el-form-item>
        <el-form-item :label="t('jobDefinitionList.bundleImportJsonLabel')">
          <el-input
            v-model="bundleImportJson"
            type="textarea"
            :rows="14"
            :placeholder="t('jobDefinitionList.bundleImportJsonPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bundleImportVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="bundleImportSaving" @click="submitBundleImport">
          {{
            bundleImportDryRun
              ? t('jobDefinitionList.bundleImportValidate')
              : t('jobDefinitionList.bundleImportConfirm')
          }}
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Upload } from 'lucide-vue-next'
  type ExecutionMode = 'FULL' | 'INCREMENTAL' | 'CDC'
  const { t, te } = useI18n({ useScope: 'global' })

  function resolveScheduleType(value?: string | null): string {
    if (!value) return ''
    const key = `enum.scheduleType.${value}`
    return te(key) ? t(key) : value
  }

  function jobTypePillStyle(value?: string | null): Record<string, string> {
    const palette: Record<string, string> = {
      ATOMIC: '#8b5cf6',
      PROCESS: 'var(--color-primary)',
      IMPORT: '#0891b2',
      EXPORT: 'var(--color-warning)',
      WORKFLOW: '#7c3aed',
      GENERAL: 'var(--color-text-secondary)',
    }
    const color = palette[String(value || 'GENERAL').toUpperCase()] ?? palette.GENERAL
    return {
      color,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      borderColor: `color-mix(in srgb, ${color} 32%, var(--color-border) 68%)`,
    }
  }

  // 列设置:jobCode(主链)/操作列始终显示;默认可见列按 redesign 作业定义表格稿对齐。
  const columnDefs = computed(() => [
    { key: 'jobName', label: t('jobDefinitionList.colJobName') },
    { key: 'jobType', label: t('jobDefinitionList.colJobType') },
    { key: 'tenantId', label: t('jobDefinitionList.colTenant'), defaultHidden: true },
    { key: 'workerGroup', label: t('jobDefinitionList.colWorkerGroup') },
    { key: 'queueCode', label: t('jobDefinitionList.colQueue') },
    { key: 'scheduleType', label: t('jobDefinitionList.colScheduleType'), defaultHidden: true },
    { key: 'executionMode', label: t('jobDefinitionList.colExecutionMode'), defaultHidden: true },
    { key: 'enabled', label: t('jobDefinitionList.colEnabled') },
    { key: 'scheduleExpr', label: t('jobDefinitionList.colScheduleExpr'), defaultHidden: true },
  ])
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import { jobApi, type JobBundlePayload } from '@/api/job'
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
  import JobConfigBasicForm from './components/JobConfigBasicForm.vue'
  import JobDefinitionDrawer from './components/JobDefinitionDrawer.vue'
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
  const pageSize = ref(15)
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
    // 跳转前关闭抽屉,避免跳到目标页 drawer 还罩着(同路由 query-only 跳转不会触发组件卸载)
    jdVisible.value = false
    void router.push({
      path: '/monitor/job-instances',
      query: { jobCode, range: 'all' },
    })
  }

  // ── 行操作工厂(给 <RowActions> 用)─────────────────────────
  function rowActions(row: ConsoleJobDefinitionResponse): RowAction[] {
    const acting = actingJobCode.value === row.jobCode
    // VIEWER 无写权限:trigger / edit / clone / toggle 全部灰显
    // 只保留只读类操作(查看实例 / 导出 bundle)
    const noWrite = !canMutateConfig.value
    return [
      {
        key: 'trigger',
        label: t('jobDefinitionList.actionTrigger'),
        primary: true,
        loading: acting,
        disabled: noWrite,
        onClick: () => triggerRow(row),
      },
      {
        key: 'edit',
        label: t('jobDefinitionList.actionEdit'),
        disabled: noWrite,
        onClick: () => openEdit(row),
      },
      {
        key: 'instances',
        // 旧"查看运行"会跳到 /monitor/job-instances 离开列表;
        // 现在改成 inline detail drawer + Runs tab,保留 oncall 上下文,
        // tab 内仍有"查看全部"链接通向完整可筛列表。
        label: t('jobDefinitionList.actionInstances'),
        onClick: () => openDetail(row),
      },
      {
        key: 'clone',
        label: t('jobDefinitionList.actionClone'),
        disabled: noWrite,
        onClick: () => cloneRow(row),
      },
      {
        key: 'export-bundle',
        label: t('jobDefinitionList.actionExportBundle'),
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
        disabled: acting || noWrite,
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

  const bundleImportVisible = ref(false)
  const bundleImportJson = ref('')
  const bundleImportTargets = ref<string[]>([])
  const bundleImportMode = ref<'SKIP_EXISTING' | 'UPSERT'>('UPSERT')
  const bundleImportDryRun = ref(false)
  const bundleImportSaving = ref(false)

  function openBundleImport() {
    bundleImportJson.value = ''
    bundleImportTargets.value = [tenant.tenantId]
    bundleImportMode.value = 'UPSERT'
    bundleImportDryRun.value = false
    bundleImportVisible.value = true
  }

  async function submitBundleImport() {
    // P2-3:防重复提交(快速连点 / 网络抖动)
    if (bundleImportSaving.value) return
    // P2:源租户必须非空(启动/切换瞬间 tenant 可能未就绪)
    const sourceTenant = tenant.tenantId?.trim()
    if (!sourceTenant) {
      ElMessage.warning(t('jobDefinitionList.bundleImportNoSourceTenant'))
      return
    }
    // P2:目标租户 trim+去空+去重,再校验非空(原写法只看数组长度,会把 [''] 发给后端)
    const targets = Array.from(
      new Set(bundleImportTargets.value.map((x) => x?.trim()).filter(Boolean)),
    ) as string[]
    if (!targets.length) {
      ElMessage.warning(t('jobDefinitionList.bundleImportNoTargetTenant'))
      return
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(bundleImportJson.value) as Record<string, unknown>
    } catch {
      ElMessage.error(t('jobDefinitionList.bundleImportBadJson'))
      return
    }
    // P1:导出文件可能是 { tenantId, jobCode, summary, bundle } 包装结构;
    // 解包到真正的 ConfigSyncBundlePayload(与向导页 JobDefinitionWizard 同款兼容写法),
    // 否则把整个 payload 当 bundle 传 → 字段不匹配 → 错误/空导入。
    const bundle = (parsed?.bundle ??
      (parsed?.data as Record<string, unknown>)?.bundle ??
      parsed ??
      {}) as JobBundlePayload
    bundleImportSaving.value = true
    try {
      await jobApi.importBundle({
        tenantId: sourceTenant,
        targetTenantIds: targets,
        mode: bundleImportMode.value,
        dryRun: bundleImportDryRun.value,
        bundle,
      })
      ElMessage.success(
        bundleImportDryRun.value
          ? t('jobDefinitionList.bundleImportDryRunDone', { n: targets.length })
          : t('jobDefinitionList.bundleImportDone', { n: targets.length }),
      )
      bundleImportVisible.value = false
      void refetch()
    } finally {
      bundleImportSaving.value = false
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
      ElMessage.success(t('jobDefinitionList.exportBundleSuccess', { code: row.jobCode }))
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

  // 按 jobType 预填触发 payload 模板:文件/内容型作业需要的必填字段(英文字段名,非 i18n 文案)。
  function triggerInputTemplate(jobType: string | undefined): string {
    switch (jobType) {
      case 'IMPORT':
        return '{\n  "templateCode": "",\n  "content": "header1,header2\\nvalue1,value2"\n}'
      case 'EXPORT':
        return '{\n  "templateCode": ""\n}'
      case 'DISPATCH':
        return '{\n  "fileId": 0\n}'
      default:
        return '{}'
    }
  }

  async function triggerRow(row: ConsoleJobDefinitionResponse) {
    let payloadText = ''
    try {
      // 文件/内容型作业(IMPORT/EXPORT/DISPATCH)裸触发(空 {})会失败(缺 templateCode/content/fileId),
      // 预填 payload 模板引导用户填必填字段——字段名是英文,不涉 i18n;非文件型保持 {}。
      const promptMsg =
        row.jobType === 'IMPORT' || row.jobType === 'EXPORT' || row.jobType === 'DISPATCH'
          ? t('jobDefinitionList.triggerPromptFileJob', { jobType: row.jobType })
          : t('jobDefinitionList.triggerPrompt')
      // inputValidator 在用户点"确认"时实时拦截 JSON 语法错,
      // 而不是关掉对话框、ElMessage 再 toast,避免用户白填一大坨参数。
      const { value } = await ElMessageBox.prompt(
        promptMsg,
        t('jobDefinitionList.triggerTitle', { code: row.jobCode }),
        {
          inputType: 'textarea',
          inputValue: triggerInputTemplate(row.jobType),
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
    } catch {
      // 错误 toast 由 API interceptor 统一展示；这里负责吞掉已处理异常，避免全局 unhandled rejection。
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

  // ── Run-centric 详情(设计三态抽屉的查看态)─────
  const detailRow = ref<ConsoleJobDefinitionResponse | null>(null)
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
        pageSize: 15,
      })
      detailRunsRows.value = pageResult.records ?? []
      detailRunsLoadedForJobCode.value = def.jobCode
    } catch {
      detailRunsRows.value = []
    } finally {
      detailRunsLoading.value = false
    }
  }

  function openDetail(row: ConsoleJobDefinitionResponse) {
    detailRow.value = row
    detailRunsRows.value = []
    detailRunsLoadedForJobCode.value = ''
    jdMode.value = 'view'
    jdVisible.value = true
    // 三态抽屉里"最近运行"是常驻分区(不再是 lazy tab),打开即拉
    void loadDetailRuns()
  }

  function goJobInstance(row: ConsoleJobInstanceResponse) {
    void router.push(`/monitor/job-instances/${row.id}`)
  }

  // ── 设计三态抽屉(view/edit/create)状态机 ─────
  const jdVisible = ref(false)
  const jdMode = ref<'view' | 'edit' | 'create'>('view')
  // 编辑态是否从查看态切入(取消时回到查看态而非直接关闭)
  const editFromView = ref(false)

  // ── 编辑态表单 ─────
  const editFormRef = ref<FormInstance>()
  const editSaving = ref(false)
  const editingId = ref<number | null>(null)
  const editingTenantId = ref('')
  const editingJobCode = ref('')
  // Day 2 (A.1):editForm 从 2 字段(executionMode/watermarkField)扩到 24 字段,
  // 对齐 BE JobDefinitionUpdateRequest。所有可编辑字段均通过 JobConfigBasicForm 暴露。
  const editForm = reactive<JobEditFormState>(createEmptyJobEditForm())
  const createFormRef = ref<FormInstance>()
  // 路由变化时自动关闭抽屉,避免跳到目标页 drawer 还罩着
  useDrawerAutoClose([jdVisible])
  const createSaving = ref(false)
  // jobType BE 枚举走 /api/console/meta/enums 动态字典;此处默认 GENERAL(通用任务,
  // P0 Task SPI 落地后内部路由到 Shell/SQL/StoredProc/HTTP builtin)。
  const createForm = reactive({
    jobCode: '',
    jobName: '',
    jobType: 'GENERAL',
    scheduleType: 'MANUAL',
    scheduleExpr: '',
    dependsOnJobCode: '',
    queueCode: '',
    workerGroup: '',
    executionMode: 'FULL' as ExecutionMode,
    watermarkField: '',
    enabled: false,
  })

  // 脏数据保护:抽屉关闭前若有未保存修改弹 confirm,避免点 Esc 丢失输入
  const createDirty = useDirtyForm(() => createForm, {
    enabled: () => jdVisible.value && jdMode.value === 'create',
  })
  const editDirty = useDirtyForm(() => editForm, {
    enabled: () => jdVisible.value && jdMode.value === 'edit',
  })
  // 抽屉打开后 autofocus 第一可编辑控件
  useFormFocus(createFormRef, () => jdVisible.value && jdMode.value === 'create')
  useFormFocus(editFormRef, () => jdVisible.value && jdMode.value === 'edit')

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

  // ── 三态抽屉:头部标题 / 状态 pill / 查看态字段分区 ─────
  const jdTitle = computed(() => {
    if (jdMode.value === 'create') return t('jobDefinitionList.jdDrawerCreateTitle')
    if (jdMode.value === 'edit') return editingJobCode.value
    return detailRow.value?.jobCode ?? ''
  })

  const jdPill = computed(() => {
    if (jdMode.value === 'create') return null
    const enabled = jdMode.value === 'edit' ? editForm.enabled : detailRow.value?.enabled
    return {
      text: enabled ? t('jobDefinitionList.optEnabled') : t('jobDefinitionList.optDisabled'),
      on: !!enabled,
    }
  })

  interface JdField {
    label: string
    value: string
    mono?: boolean
    wide?: boolean
    json?: boolean
  }

  function formatJson(raw: string | undefined | null): string {
    if (!raw) return '—'
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  /** 查看态字段分组:口径与原 JobConfigBasicSection 六组(基本/调度/资源/重试/参数/审计)一致。 */
  const viewGroups = computed<Array<{ title: string; fields: JdField[] }>>(() => {
    const job = detailRow.value
    if (!job) return []
    const dash = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v))
    const groups: Array<{ title: string; fields: JdField[] }> = [
      {
        title: t('jobConfigBasic.groupBasic'),
        fields: [
          { label: t('jobConfigBasic.fieldJobCode'), value: dash(job.jobCode), mono: true },
          { label: t('jobConfigBasic.fieldJobName'), value: dash(job.jobName) },
          { label: t('jobConfigBasic.fieldJobType'), value: dash(job.jobType), mono: true },
          {
            label: t('jobConfigBasic.fieldEnabled'),
            value: job.enabled ? t('common.yes') : t('common.no'),
          },
          {
            label: t('jobConfigBasic.fieldExecutionMode'),
            value: resolveEnumLabel('executionMode', job.executionMode),
          },
          {
            label: t('jobConfigBasic.fieldWatermark'),
            value: dash(job.watermarkField),
            mono: true,
          },
        ],
      },
      {
        title: t('jobConfigBasic.groupSchedule'),
        fields: [
          {
            label: t('jobConfigBasic.fieldScheduleType'),
            value: dash(job.scheduleType),
            mono: true,
          },
          {
            label: t('jobConfigBasic.fieldScheduleExpr'),
            value: dash(job.scheduleExpr),
            mono: true,
          },
          { label: 'dependsOnJobCode', value: dash(job.dependsOnJobCode), mono: true },
          {
            label: t('jobConfigBasic.fieldCalendarCode'),
            value: dash(job.calendarCode),
            mono: true,
          },
          { label: t('jobConfigBasic.fieldWindowCode'), value: dash(job.windowCode), mono: true },
        ],
      },
      {
        title: t('jobConfigBasic.groupResource'),
        fields: [
          { label: t('jobConfigBasic.fieldQueueCode'), value: dash(job.queueCode), mono: true },
          { label: t('jobConfigBasic.fieldWorkerGroup'), value: dash(job.workerGroup) },
          {
            label: t('jobConfigBasic.fieldShardStrategy'),
            value: dash(job.shardStrategy),
            mono: true,
          },
          {
            label: t('jobConfigBasic.fieldTimeoutSeconds'),
            value: dash(job.timeoutSeconds),
            mono: true,
          },
        ],
      },
      {
        title: t('jobConfigBasic.groupRetry'),
        fields: [
          { label: t('jobConfigBasic.fieldRetryPolicy'), value: dash(job.retryPolicy), mono: true },
          {
            label: t('jobConfigBasic.fieldRetryMaxCount'),
            value: dash(job.retryMaxCount),
            mono: true,
          },
          {
            label: t('jobConfigBasic.fieldExecutionHandler'),
            value: dash(job.executionHandler),
            mono: true,
            wide: true,
          },
        ],
      },
    ]
    const paramFields: JdField[] = []
    if (job.paramSchema) {
      paramFields.push({
        label: t('jobConfigBasic.fieldParamSchema'),
        value: formatJson(job.paramSchema),
        json: true,
        wide: true,
      })
    }
    if (job.defaultParams) {
      paramFields.push({
        label: t('jobConfigBasic.fieldDefaultParams'),
        value: formatJson(job.defaultParams),
        json: true,
        wide: true,
      })
    }
    if (paramFields.length) {
      groups.push({ title: t('jobConfigBasic.groupParams'), fields: paramFields })
    }
    groups.push({
      title: t('jobConfigBasic.groupAudit'),
      fields: [
        { label: t('jobConfigBasic.fieldCreatedAt'), value: dash(job.createdAt), mono: true },
        { label: t('jobConfigBasic.fieldUpdatedAt'), value: dash(job.updatedAt), mono: true },
      ],
    })
    return groups
  })

  // ── 三态抽屉底部操作 ─────
  async function onJdClose() {
    if (jdMode.value === 'create') {
      if (createSaving.value) return
      if (!(await createDirty.confirmDiscard())) return
    } else if (jdMode.value === 'edit') {
      if (editSaving.value) return
      if (!(await editDirty.confirmDiscard())) return
    }
    jdVisible.value = false
  }

  async function onJdCancel() {
    // 编辑态且从查看态切入:取消回到查看态;其余直接关闭
    if (jdMode.value === 'edit' && editFromView.value && detailRow.value) {
      if (editSaving.value) return
      if (!(await editDirty.confirmDiscard())) return
      jdMode.value = 'view'
      return
    }
    await onJdClose()
  }

  function onJdSave() {
    if (jdMode.value === 'create') void submitCreate()
    else if (jdMode.value === 'edit') void submitEdit()
  }

  function onJdEdit() {
    if (!canMutateConfig.value || !detailRow.value) return
    openEdit(detailRow.value, true)
  }

  function onJdExport() {
    if (detailRow.value) void exportBundle(detailRow.value)
  }

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
      return JOB_CODE_PATTERN.test(value) ? cb() : cb(new Error(t('jobDefinitionList.jobCodeRule')))
    },
    trigger: 'blur',
  }
  editFormRules.dependsOnJobCode = [jobCodePatternRule]
  const createFormRules: FormRules = {
    jobCode: [rulesRequired(t('jobDefinitionList.ruleJobCodeRequired')), jobCodePatternRule],
    jobType: [rulesRequired(t('jobDefinitionList.ruleJobTypeRequired'))],
    scheduleType: [rulesRequired(t('jobDefinitionList.ruleScheduleTypeRequired'))],
    watermarkField: [watermarkRule],
    dependsOnJobCode: [jobCodePatternRule],
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
  watch(
    () => editForm.scheduleType,
    (type) => {
      if (type === 'MANUAL') {
        editForm.scheduleExpr = ''
        editForm.dependsOnJobCode = ''
        editForm.calendarCode = ''
        editForm.windowCode = ''
      }
    },
  )
  watch(
    () => createForm.scheduleType,
    (type) => {
      if (type === 'MANUAL') {
        createForm.scheduleExpr = ''
        createForm.dependsOnJobCode = ''
      }
    },
  )

  function resetCreateForm() {
    createForm.jobCode = ''
    createForm.jobName = ''
    createForm.jobType = 'GENERAL'
    createForm.scheduleType = 'MANUAL'
    createForm.scheduleExpr = ''
    createForm.dependsOnJobCode = ''
    createForm.queueCode = ''
    createForm.workerGroup = ''
    createForm.executionMode = 'FULL'
    createForm.watermarkField = ''
    createForm.enabled = false
  }

  function openCreate() {
    resetCreateForm()
    jdMode.value = 'create'
    jdVisible.value = true
    void createFormRef.value?.clearValidate()
    // 表单已重置 → 基线对齐空表,后续修改触发 isDirty
    createDirty.markPristine()
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
        dependsOnJobCode:
          createForm.scheduleType === 'MANUAL'
            ? ''
            : createForm.dependsOnJobCode.trim() || undefined,
        queueCode: createForm.queueCode.trim() || undefined,
        workerGroup: createForm.workerGroup.trim() || undefined,
        executionMode: createForm.executionMode,
        watermarkField:
          createForm.executionMode === 'INCREMENTAL' ? createForm.watermarkField.trim() : '',
        enabled: createForm.enabled,
      })
      ElMessage.success(t('jobDefinitionList.createSuccess', { code: createForm.jobCode }))
      // 保存成功后基线对齐,关闭流程不再弹"放弃修改"
      createDirty.markPristine()
      jdVisible.value = false
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

  function openEdit(row: ConsoleJobDefinitionResponse, fromView = false) {
    editingId.value = row.id
    editingTenantId.value = row.tenantId || filters.tenantId || tenant.tenantId
    editingJobCode.value = row.jobCode
    // Day 2 (A.1):从 row 拷贝全量字段到 editForm,而非仅 2 字段
    Object.assign(editForm, jobResponseToEditForm(row))
    editFromView.value = fromView
    jdMode.value = 'edit'
    jdVisible.value = true
    void editFormRef.value?.clearValidate()
    // 基线 = 加载完的当前 row,后续修改触发 isDirty
    editDirty.markPristine()
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
        dependsOnJobCode:
          editForm.scheduleType === 'MANUAL' ? '' : editForm.dependsOnJobCode.trim() || undefined,
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
      editDirty.markPristine()
      jdVisible.value = false
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
  .job-header-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

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

  /* ── 三态抽屉查看态:分区 + 字段块(dump: proto-jobs_edit.html OVERLAY 数值) ── */
  .jd-section {
    margin-bottom: 20px;
  }

  .jd-section:last-child {
    margin-bottom: 0;
  }

  .jd-section__label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--color-text-tertiary);
    margin-bottom: 12px;
  }

  .jd-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .jd-field {
    background: var(--color-bg-card);
    padding: 11px 14px;
  }

  .jd-field--wide {
    grid-column: 1 / -1;
  }

  .jd-field__label {
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .jd-field__value {
    margin-top: 5px;
    font-size: 13px;
    color: var(--color-text-primary);
    word-break: break-all;
  }

  .jd-field__value.is-mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .jd-field__json {
    margin: 5px 0 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--input-bg);
    padding: 8px 10px;
    border-radius: 7px;
    max-height: 200px;
    overflow: auto;
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
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .definition-link:hover {
    text-decoration: underline;
  }

  .jd-type-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .jd-cell-sub {
    color: var(--color-text-secondary);
  }

  .jd-cell-mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
