<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="filtered"
        :loading="tableBlocking"
        :error="jobLoadError"
        :on-retry="refetch"
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

        <el-table-column prop="jobCode" :label="t('jobDefinitionList.colJobCode')" min-width="140">
          <template #default="{ row }">
            <CopyableText :text="row.jobCode" />
          </template>
        </el-table-column>
        <el-table-column
          prop="jobName"
          :label="t('jobDefinitionList.colJobName')"
          min-width="160"
        />
        <el-table-column prop="tenantId" :label="t('jobDefinitionList.colTenant')" width="100" />
        <el-table-column
          prop="workerGroup"
          :label="t('jobDefinitionList.colWorkerGroup')"
          width="140"
        />
        <el-table-column prop="queueCode" :label="t('jobDefinitionList.colQueue')" width="140" />
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
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column :label="t('jobDefinitionList.colActions')" width="180" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" />
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      v-model="editDrawerVisible"
      :title="editDrawerTitle"
      size="520px"
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
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveScheduleType(value?: string | null): string {
    if (!value) return ''
    const key = `enum.scheduleType.${value}`
    return te(key) ? t(key) : value
  }
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import { jobApi } from '@/api/job'
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
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import type { ConsoleJobDefinitionResponse } from '@/types/console-api'

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
    return runRefresh(() => refetch())
  }

  function goInstances(jobCode: string) {
    void router.push({ path: '/monitor/job-instances', query: { jobCode } })
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
        label: t('jobDefinitionList.actionInstances'),
        onClick: () => goInstances(row.jobCode),
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
      await jobApi.toggleEnabled(row.jobCode, filters.tenantId || tenant.tenantId, !row.enabled)
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
      await jobApi.clone(row.id, filters.tenantId || tenant.tenantId)
      ElMessage.success(t('jobDefinitionList.cloneSuccess', { code: row.jobCode }))
      await refetch()
    } catch {
      /* cancel */
    }
  }

  // ── 编辑抽屉(轻量版,只露 ExecutionMode + watermarkField,部分更新) ─────
  const editFormRef = ref<FormInstance>()
  const editDrawerVisible = ref(false)
  const editSaving = ref(false)
  const editingId = ref<number | null>(null)
  const editingTenantId = ref('')
  const editingJobCode = ref('')
  const editForm = reactive({
    executionMode: 'FULL',
    watermarkField: '',
  })

  const { data: metaEnumsData } = useConsoleMetaEnumsQuery()
  const executionModeOptions = computed(() =>
    pickMetaEnumGroup(metaEnumsData.value, 'executionMode'),
  )

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

  // 切到 FULL/CDC 时自动清空水位字段
  watch(
    () => editForm.executionMode,
    (mode) => {
      if (mode !== 'INCREMENTAL') editForm.watermarkField = ''
    },
  )

  function openEdit(row: ConsoleJobDefinitionResponse) {
    editingId.value = row.id
    editingTenantId.value = row.tenantId || filters.tenantId || tenant.tenantId
    editingJobCode.value = row.jobCode
    editForm.executionMode = row.executionMode || 'FULL'
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
    const valid = await editFormRef.value?.validate().catch(() => false)
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
  }

  useTenantReload(loadMeta)
</script>

<style scoped>
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
</style>
