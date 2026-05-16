<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          {{ t('pipelineDefinitionList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
        :error="loadError"
        :on-retry="load"
        :has-active-filters="hasActiveFilters"
      >
        <template v-if="!hasActiveFilters" #empty>
          <EmptyState :description="t('pipelineDefinitionList.emptyDescription')" :image-size="80">
            <template #action>
              <el-button type="primary" :icon="Plus" @click="openCreate">
                {{ t('pipelineDefinitionList.headerCreate') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onQueryBarSearch"
            @reset="onQueryBarReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('pipelineDefinitionList.keywordLabel')">
              <el-input
                v-model="keyword"
                clearable
                :placeholder="t('pipelineDefinitionList.keywordPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('pipelineDefinitionList.typeLabel')">
              <el-select
                class="query-w-160"
                v-model="pipelineType"
                clearable
                filterable
                :placeholder="t('pipelineDefinitionList.typePlaceholder')"
              >
                <el-option
                  v-for="option in pipelineTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('pipelineDefinitionList.enabledLabel')">
              <el-select
                class="query-w-120"
                v-model="enabledFilter"
                clearable
                :placeholder="t('pipelineDefinitionList.enabledPlaceholder')"
              >
                <el-option :label="t('pipelineDefinitionList.optEnabled')" :value="true" />
                <el-option :label="t('pipelineDefinitionList.optDisabled')" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="pipelineCode"
          :label="t('pipelineDefinitionList.colCode')"
          width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="pipelineName"
          :label="t('pipelineDefinitionList.colName')"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column
          prop="pipelineType"
          :label="t('pipelineDefinitionList.colType')"
          width="120"
        />
        <DatetimeColumn
          prop="updatedAt"
          :label="t('pipelineDefinitionList.colUpdatedAt')"
          width="180"
        />
        <el-table-column :label="t('pipelineDefinitionList.colEnabled')" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="togglingId === row.id"
              inline-prompt
              :active-text="t('pipelineDefinitionList.switchOn')"
              :inactive-text="t('pipelineDefinitionList.switchOff')"
              @change="toggle(row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('pipelineDefinitionList.colActions')" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row, 'runs')">
                {{ t('pipelineDefinitionList.actionRuns') }}
              </el-button>
              <el-button size="small" plain @click="openEdit(row)">
                {{ t('pipelineDefinitionList.actionEdit') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="drawerVisible" :title="drawerTitle" size="800px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-form-item label="pipelineCode" prop="pipelineCode">
          <el-input v-model="form.pipelineCode" :disabled="editingId != null" />
        </el-form-item>
        <el-form-item label="pipelineName" prop="pipelineName">
          <el-input v-model="form.pipelineName" />
        </el-form-item>
        <el-form-item label="pipelineType" prop="pipelineType">
          <el-input
            v-model="form.pipelineType"
            :placeholder="t('pipelineDefinitionList.typeFieldPlaceholder')"
          />
        </el-form-item>
        <el-form-item label="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="description">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('pipelineDefinitionList.stepsTitle')">
          <div class="steps-editor">
            <div class="steps-toolbar">
              <el-button
                type="primary"
                :icon="Plus"
                class="pretty-add-button pretty-add-button--mini"
                @click="addStep"
              >
                {{ t('pipelineDefinitionList.addStep') }}
              </el-button>
            </div>
            <div class="steps-list">
              <div
                v-for="(row, index) in steps"
                :key="`${row.stepCode}-${index}`"
                class="step-card"
                :class="{ 'step-card--dragging': draggingIndex === index }"
                draggable="true"
                @dragstart="onDragStart(index)"
                @dragover.prevent
                @drop="onDrop(index)"
                @dragend="onDragEnd"
              >
                <div class="step-card__head">
                  <div class="step-card__title">
                    <span class="step-card__drag">::</span>
                    <span>{{ t('pipelineDefinitionList.stepLabel', { n: index + 1 }) }}</span>
                  </div>
                  <div class="step-card__actions">
                    <el-button link :disabled="index === 0" @click="moveStepUp(index)">
                      {{ t('pipelineDefinitionList.moveUp') }}
                    </el-button>
                    <el-button
                      link
                      :disabled="index === steps.length - 1"
                      @click="moveStepDown(index)"
                    >
                      {{ t('pipelineDefinitionList.moveDown') }}
                    </el-button>
                    <el-button link type="danger" @click="removeStep(index)">
                      {{ t('pipelineDefinitionList.deleteStep') }}
                    </el-button>
                  </div>
                </div>
                <div class="step-card__grid">
                  <el-input v-model="row.stepCode" placeholder="stepCode" />
                  <el-input v-model="row.stepName" placeholder="stepName" />
                  <el-input v-model="row.stageCode" placeholder="stageCode" />
                  <el-input v-model="row.stepType" placeholder="implCode" />
                  <el-input v-model="row.description" placeholder="description" />
                </div>
              </div>
            </div>
            <el-input
              :model-value="stepsJsonPreview"
              type="textarea"
              :rows="8"
              readonly
              class="steps-preview"
            />
          </div>
        </el-form-item>
        <div class="drawer-actions">
          <el-button @click="drawerVisible = false">
            {{ t('pipelineDefinitionList.drawerCancel') }}
          </el-button>
          <el-button type="primary" :loading="saving" @click="submitForm">
            {{ t('pipelineDefinitionList.drawerSave') }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>

    <!-- Run-centric 详情抽屉(P2 对称):Overview + 最近运行 -->
    <el-drawer
      v-model="detailVisible"
      :title="t('pipelineDefinitionList.detailTitle', { code: detailRow?.pipelineCode || '' })"
      size="720px"
    >
      <el-tabs v-if="detailRow" v-model="activeDetailTab">
        <el-tab-pane name="overview" :label="t('pipelineDefinitionList.detailTabOverview')">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="pipelineCode">{{
              detailRow.pipelineCode
            }}</el-descriptions-item>
            <el-descriptions-item label="pipelineName">{{
              detailRow.pipelineName
            }}</el-descriptions-item>
            <el-descriptions-item label="pipelineType">{{
              detailRow.pipelineType || '—'
            }}</el-descriptions-item>
            <el-descriptions-item label="enabled">
              {{ detailRow.enabled ? t('common.yes') : t('common.no') }}
            </el-descriptions-item>
            <el-descriptions-item label="tenantId">{{ detailRow.tenantId }}</el-descriptions-item>
            <el-descriptions-item v-if="detailRow.description" label="description" :span="2">
              {{ detailRow.description }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane name="runs" :lazy="true">
          <template #label>
            <span>
              {{ t('pipelineDefinitionList.detailTabRuns') }}
              <el-tag v-if="detailRunsRows.length" size="small" round>{{
                detailRunsRows.length
              }}</el-tag>
            </span>
          </template>
          <div class="detail-runs-header">
            <span>{{
              t('pipelineDefinitionList.detailRunsHint', { code: detailRow.pipelineCode })
            }}</span>
            <el-button text type="primary" @click="goInstancesFiltered(detailRow.pipelineCode)">
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
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormInstance, FormRules } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    createPipelineDefinition,
    queryPipelineDefinitionDetail,
    queryPipelineDefinitions,
    togglePipelineDefinition,
    updatePipelineDefinition,
    type PipelineDefinitionForm,
    type PipelineDefinitionRow,
  } from '@/api/system'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRouter } from 'vue-router'
  import { instanceApi } from '@/api/instance'
  import { fmtDatetime } from '@/utils/datetime'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const togglingId = ref<number | null>(null)
  const rows = ref<PipelineDefinitionRow[]>([])
  const allRows = ref<PipelineDefinitionRow[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const pipelineType = ref('')
  const enabledFilter = ref<boolean | undefined>()
  const hasActiveFilters = computed(
    () => !!(keyword.value.trim() || pipelineType.value.trim() || enabledFilter.value != null),
  )
  const drawerVisible = ref(false)
  const saving = ref(false)

  // ── Run-centric 详情抽屉(P2 对称) ─────
  const router = useRouter()
  const detailVisible = ref(false)
  const detailRow = ref<PipelineDefinitionRow | null>(null)
  const activeDetailTab = ref<'overview' | 'runs'>('overview')
  const detailRunsRows = ref<ConsoleJobInstanceResponse[]>([])
  const detailRunsLoading = ref(false)
  const detailRunsLoadedFor = ref('')

  // Pipeline 在 BE 落到 job_instance 表(pipelineCode == jobCode);用 instanceApi.list 拉
  async function loadDetailRuns() {
    const def = detailRow.value
    if (!def?.pipelineCode || detailRunsLoadedFor.value === def.pipelineCode) return
    detailRunsLoading.value = true
    try {
      const pageResult = await instanceApi.list({
        tenantId: def.tenantId ?? tenant.tenantId,
        jobCode: def.pipelineCode,
        page: 1,
        pageSize: 20,
      })
      detailRunsRows.value = pageResult.records ?? []
      detailRunsLoadedFor.value = def.pipelineCode
    } catch {
      detailRunsRows.value = []
    } finally {
      detailRunsLoading.value = false
    }
  }

  function openDetail(row: PipelineDefinitionRow, initialTab: 'overview' | 'runs') {
    detailRow.value = row
    detailRunsRows.value = []
    detailRunsLoadedFor.value = ''
    activeDetailTab.value = initialTab
    detailVisible.value = true
    if (initialTab === 'runs') void loadDetailRuns()
  }

  function goJobInstance(row: ConsoleJobInstanceResponse) {
    void router.push(`/monitor/job-instances/${row.id}`)
  }

  function goInstancesFiltered(pipelineCode: string) {
    // 同 JobDefinitionList.goInstances:看的是该 pipeline 的全部历史实例,清掉今日锚定
    void router.push({
      path: '/monitor/job-instances',
      query: { jobCode: pipelineCode, range: 'all' },
    })
  }

  watch(activeDetailTab, (tab) => {
    if (tab === 'runs') void loadDetailRuns()
  })
  const editingId = ref<number | null>(null)
  const draggingIndex = ref<number | null>(null)
  const form = ref<PipelineDefinitionForm>({
    tenantId: '',
    pipelineCode: '',
    pipelineName: '',
    pipelineType: '',
    enabled: true,
    description: '',
  })
  const steps = ref<
    Array<{
      stepCode: string
      stepName: string
      stageCode: string
      stepType: string
      description: string
    }>
  >([])

  const queryKeyword = computed(() => keyword.value.trim().toLowerCase())
  const drawerTitle = computed(() =>
    editingId.value == null
      ? t('pipelineDefinitionList.drawerCreateTitle')
      : t('pipelineDefinitionList.drawerEditTitle'),
  )
  const pipelineTypeOptions = computed(() =>
    Array.from(
      new Set(
        allRows.value.map((row) => row.pipelineType).filter((item): item is string => !!item),
      ),
    ),
  )

  const formRules: FormRules = {
    tenantId: [
      { required: true, message: t('pipelineDefinitionList.ruleTenantId'), trigger: 'blur' },
    ],
    pipelineCode: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineCode'), trigger: 'blur' },
      {
        pattern: /^[a-zA-Z0-9_-]+$/,
        message: t('pipelineDefinitionList.rulePipelineCodePattern'),
        trigger: 'blur',
      },
    ],
    pipelineName: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineName'), trigger: 'blur' },
    ],
    pipelineType: [
      { required: true, message: t('pipelineDefinitionList.rulePipelineType'), trigger: 'blur' },
    ],
  }

  function resetForm() {
    form.value = {
      tenantId: tenant.tenantId,
      pipelineCode: '',
      pipelineName: '',
      pipelineType: '',
      enabled: true,
      description: '',
    }
    steps.value = []
  }

  const stepsJsonPreview = computed(() => JSON.stringify(steps.value, null, 2))

  function onQueryBarSearch() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

  function onQueryBarReset() {
    return runReset(async () => {
      keyword.value = ''
      pipelineType.value = ''
      enabledFilter.value = undefined
      page.value = 1
      await load()
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const pr = await queryPipelineDefinitions(tenant.tenantId, 1, 200)
      allRows.value = pr.items
      const filtered = queryKeyword.value
        ? pr.items.filter((row) =>
            `${row.pipelineCode} ${row.pipelineName} ${row.pipelineType}`
              .toLowerCase()
              .includes(queryKeyword.value),
          )
        : pr.items
      const refined = filtered.filter((row) => {
        if (pipelineType.value.trim() && !row.pipelineType?.includes(pipelineType.value.trim())) {
          return false
        }
        if (enabledFilter.value != null && row.enabled !== enabledFilter.value) return false
        return true
      })
      total.value = refined.length
      const start = (page.value - 1) * pageSize.value
      rows.value = refined.slice(start, start + pageSize.value)
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    editingId.value = null
    resetForm()
    drawerVisible.value = true
    formRef.value?.clearValidate()
  }

  async function openEdit(row: PipelineDefinitionRow) {
    formRef.value?.clearValidate()
    const detail = await queryPipelineDefinitionDetail(tenant.tenantId, row.id)
    const obj = detail as Record<string, unknown>
    editingId.value = row.id
    form.value = {
      tenantId: String(obj.tenantId ?? row.tenantId ?? tenant.tenantId),
      // BE PipelineDefinitionDetailResponse 字段是 jobCode,本地 form 沿用 pipelineCode 名
      pipelineCode: String(obj.jobCode ?? obj.pipelineCode ?? row.pipelineCode ?? ''),
      pipelineName: String(obj.pipelineName ?? row.pipelineName ?? ''),
      pipelineType: String(obj.pipelineType ?? row.pipelineType ?? ''),
      enabled: Boolean(obj.enabled ?? row.enabled),
      description: String(obj.description ?? row.description ?? ''),
    }
    steps.value = Array.isArray(obj.steps)
      ? obj.steps.map((item) => {
          const step = item as Record<string, unknown>
          return {
            stepCode: String(step.stepCode ?? ''),
            stageCode: String(step.stageCode ?? ''),
            // BE StepResponse: stepName / implCode;本地编辑模型用 description / stepType 兼容历史模板
            stepName: String(step.stepName ?? ''),
            stepType: String(step.implCode ?? step.stepType ?? ''),
            description: String(step.description ?? ''),
          }
        })
      : []
    drawerVisible.value = true
  }

  async function submitForm() {
    const valid = await formRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        ElMessage.warning(t('pipelineDefinitionList.checkRequired'))
        // 自动滚到首个错误字段:大表单时用户看不到错误位置
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) formRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return

    const payload = {
      tenantId: form.value.tenantId || tenant.tenantId,
      // BE PipelineDefinitionSaveRequest 必填 jobCode(@NotBlank);本地 form pipelineCode 翻译过去
      jobCode: form.value.pipelineCode,
      pipelineName: form.value.pipelineName,
      pipelineType: form.value.pipelineType,
      enabled: form.value.enabled,
      description: form.value.description,
      steps: steps.value
        .filter((item) => item.stepCode || item.stageCode || item.stepType || item.description)
        .map((item, index) => ({
          stepCode: item.stepCode,
          // BE StepItem 必填 stepName + implCode;UI 暂时用 description 当 stepName,stepType 当 implCode
          stepName: item.stepName || item.description || item.stepCode,
          stageCode: item.stageCode,
          implCode: item.stepType,
          stepOrder: index + 1,
        })),
    }
    saving.value = true
    const isCreate = editingId.value == null
    try {
      if (isCreate) await createPipelineDefinition(payload)
      else await updatePipelineDefinition(editingId.value!, payload)
      ElMessage.success(
        t('pipelineDefinitionList.saveSuccess', {
          action: isCreate
            ? t('pipelineDefinitionList.actionCreate')
            : t('pipelineDefinitionList.actionUpdate'),
          code: form.value.pipelineCode,
        }),
      )
      drawerVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function toggle(row: PipelineDefinitionRow) {
    if (!row.id) return
    const target = !row.enabled
    try {
      const action = target
        ? t('pipelineDefinitionList.enable')
        : t('pipelineDefinitionList.disable')
      await ElMessageBox.confirm(
        t('pipelineDefinitionList.toggleConfirmText', { code: row.pipelineCode, action }),
        t('pipelineDefinitionList.toggleConfirmTitle'),
        { type: 'warning' },
      )
    } catch {
      return
    }
    togglingId.value = row.id
    try {
      await togglePipelineDefinition(row.id, tenant.tenantId, target)
      row.enabled = target
      const action = target
        ? t('pipelineDefinitionList.enable')
        : t('pipelineDefinitionList.disable')
      ElMessage.success(
        t('pipelineDefinitionList.toggleSuccess', { action, code: row.pipelineCode }),
      )
    } finally {
      togglingId.value = null
    }
  }

  function addStep() {
    steps.value.push({
      stepCode: '',
      stepName: '',
      stageCode: '',
      stepType: '',
      description: '',
    })
  }

  function removeStep(index: number) {
    steps.value.splice(index, 1)
  }

  function swapSteps(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= steps.value.length || to >= steps.value.length)
      return
    const list = [...steps.value]
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    steps.value = list
  }

  function moveStepUp(index: number) {
    swapSteps(index, index - 1)
  }

  function moveStepDown(index: number) {
    swapSteps(index, index + 1)
  }

  function onDragStart(index: number) {
    draggingIndex.value = index
  }

  function onDrop(index: number) {
    if (draggingIndex.value == null) return
    swapSteps(draggingIndex.value, index)
    draggingIndex.value = null
  }

  function onDragEnd() {
    draggingIndex.value = null
  }

  watch([keyword, pipelineType, enabledFilter, page, pageSize], () => load())

  useSseAutoReload({
    domain: 'pipeline-definitions',
    reload: load,
    scope: () => tenant.tenantId,
  })

  useTenantReload(() => {
    resetForm()
    void load()
  })
</script>

<style scoped>
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
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

  .steps-editor {
    width: 100%;
  }

  .steps-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .step-card {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg);
    padding: 12px;
    background: var(--color-bg-card, #fff);
  }

  .step-card--dragging {
    opacity: 0.6;
  }

  .step-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .step-card__title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .step-card__drag {
    cursor: grab;
    color: var(--color-text-secondary);
    user-select: none;
  }

  .step-card__actions {
    display: inline-flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .step-card__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .steps-preview {
    margin-top: 10px;
  }

  @media (max-width: 900px) {
    .step-card__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
