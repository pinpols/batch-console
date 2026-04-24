<template>
  <PageContainer>
    <PageHeader
      title="Pipeline 定义"
      description="对接 `pipeline-definitions` 的列表、detail、toggle，以及 create/update 表单。"
    >
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          新增 Pipeline
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="tableRows"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="loading"
            :refresh-busy="loading"
            @search="onQueryBarSearch"
            @reset="onQueryBarReset"
            @refresh="load"
          >
            <el-form-item label="关键字">
              <el-input
                v-model="keyword"
                clearable
                placeholder="请输入 pipelineCode / pipelineName"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                class="query-w-160"
                v-model="pipelineType"
                clearable
                filterable
                placeholder="请选择 pipelineType"
              >
                <el-option
                  v-for="option in pipelineTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="启用">
              <el-select class="query-w-120" v-model="enabledFilter" clearable placeholder="全部">
                <el-option label="启用" :value="true" />
                <el-option label="停用" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="pipelineCode" label="编码" min-width="160" />
        <el-table-column prop="pipelineName" label="名称" min-width="180" />
        <el-table-column prop="pipelineType" label="类型" width="120" />
        <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="启用" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="togglingId === row.id"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="toggle(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">编辑</el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="drawerVisible" :title="drawerTitle" size="760px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-form-item label="tenantId" prop="tenantId">
          <TenantSelect v-model="form.tenantId" select-class="query-w-full" />
        </el-form-item>
        <el-form-item label="pipelineCode" prop="pipelineCode">
          <el-input v-model="form.pipelineCode" :disabled="editingId != null" />
        </el-form-item>
        <el-form-item label="pipelineName" prop="pipelineName">
          <el-input v-model="form.pipelineName" />
        </el-form-item>
        <el-form-item label="pipelineType" prop="pipelineType">
          <el-input v-model="form.pipelineType" placeholder="如 FILE_IMPORT / FILE_EXPORT" />
        </el-form-item>
        <el-form-item label="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="description">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="步骤编辑">
          <div class="steps-editor">
            <div class="steps-toolbar">
              <el-button
                type="primary"
                :icon="Plus"
                class="pretty-add-button pretty-add-button--mini"
                @click="addStep"
              >
                新增步骤
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
                    <span>步骤 {{ index + 1 }}</span>
                  </div>
                  <div class="step-card__actions">
                    <el-button link :disabled="index === 0" @click="moveStepUp(index)"
                      >上移</el-button
                    >
                    <el-button
                      link
                      :disabled="index === steps.length - 1"
                      @click="moveStepDown(index)"
                    >
                      下移
                    </el-button>
                    <el-button link type="danger" @click="removeStep(index)">删除</el-button>
                  </div>
                </div>
                <div class="step-card__grid">
                  <el-input v-model="row.stepCode" placeholder="stepCode" />
                  <el-input v-model="row.stageCode" placeholder="stageCode" />
                  <el-input v-model="row.stepType" placeholder="stepType" />
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
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
        </div>
      </el-form>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
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
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'

  const tenant = useTenantStore()
  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const togglingId = ref<number | null>(null)
  const rows = ref<PipelineDefinitionRow[]>([])
  const allRows = ref<PipelineDefinitionRow[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const pipelineType = ref('')
  const enabledFilter = ref<boolean | undefined>()
  const drawerVisible = ref(false)
  const saving = ref(false)
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
    Array<{ stepCode: string; stageCode: string; stepType: string; description: string }>
  >([])

  const queryKeyword = computed(() => keyword.value.trim().toLowerCase())
  const tableRows = computed(() => rows.value as unknown as Record<string, unknown>[])
  const drawerTitle = computed(() => (editingId.value == null ? '新建 Pipeline' : '编辑 Pipeline'))
  const pipelineTypeOptions = computed(() =>
    Array.from(
      new Set(
        allRows.value.map((row) => row.pipelineType).filter((item): item is string => !!item),
      ),
    ),
  )

  const formRules: FormRules = {
    tenantId: [{ required: true, message: '请填写 tenantId', trigger: 'blur' }],
    pipelineCode: [
      { required: true, message: '请填写 pipelineCode', trigger: 'blur' },
      {
        pattern: /^[a-zA-Z0-9_-]+$/,
        message: '只允许字母、数字、下划线和连字符',
        trigger: 'blur',
      },
    ],
    pipelineName: [{ required: true, message: '请填写 pipelineName', trigger: 'blur' }],
    pipelineType: [{ required: true, message: '请填写 pipelineType', trigger: 'blur' }],
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
    page.value = 1
    void load()
  }

  function onQueryBarReset() {
    keyword.value = ''
    pipelineType.value = ''
    enabledFilter.value = undefined
    page.value = 1
    void load()
  }

  async function load() {
    loading.value = true
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
      pipelineCode: String(obj.pipelineCode ?? row.pipelineCode ?? ''),
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
            stepType: String(step.stepType ?? ''),
            description: String(step.description ?? ''),
          }
        })
      : []
    drawerVisible.value = true
  }

  async function submitForm() {
    const valid = await formRef.value?.validate().catch(() => {
      ElMessage.warning('请检查表单必填项')
      return false
    })
    if (!valid) return

    const payload = {
      tenantId: form.value.tenantId || tenant.tenantId,
      pipelineCode: form.value.pipelineCode,
      pipelineName: form.value.pipelineName,
      pipelineType: form.value.pipelineType,
      enabled: form.value.enabled,
      description: form.value.description,
      steps: steps.value
        .filter((item) => item.stepCode || item.stageCode || item.stepType || item.description)
        .map((item, index) => ({
          stepCode: item.stepCode,
          stageCode: item.stageCode,
          stepType: item.stepType,
          description: item.description,
          stepOrder: index + 1,
        })),
    }
    saving.value = true
    try {
      if (editingId.value == null) await createPipelineDefinition(payload)
      else await updatePipelineDefinition(editingId.value, payload)
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
      await ElMessageBox.confirm(
        `确认将 Pipeline ${row.pipelineCode} ${target ? '启用' : '停用'}吗？`,
        '切换 Pipeline 状态',
        { type: 'warning' },
      )
    } catch {
      return
    }
    togglingId.value = row.id
    try {
      await togglePipelineDefinition(row.id, tenant.tenantId, target)
      row.enabled = target
    } finally {
      togglingId.value = null
    }
  }

  function addStep() {
    steps.value.push({
      stepCode: '',
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
