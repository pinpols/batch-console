<template>
  <PageContainer>
    <PageHeader
      title="工作流定义"
      description="GET /api/console/queries/workflow-definitions（PageResponse 端上聚合后筛选）"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item label="Workflow Code">
              <el-input
                class="query-w-160"
                v-model="filters.workflowCode"
                clearable
                placeholder="请输入 workflowCode"
              />
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                class="query-w-160"
                v-model="filters.workflowName"
                clearable
                placeholder="请输入 workflowName"
              />
            </el-form-item>
            <el-form-item label="启用">
              <el-select class="query-w-120" v-model="filters.enabled" clearable placeholder="全部">
                <el-option label="启用" :value="true" />
                <el-option label="停用" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                class="query-w-160"
                v-model="filters.workflowType"
                clearable
                filterable
                placeholder="请选择 workflowType"
              >
                <el-option
                  v-for="option in workflowTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="版本">
              <el-input-number
                class="query-w-140"
                v-model="filters.version"
                :min="1"
                :step="1"
                controls-position="right"
                placeholder="版本"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="workflowCode" label="Code" min-width="140" />
        <el-table-column prop="workflowName" label="名称" min-width="160" />
        <el-table-column prop="workflowType" label="类型" width="120" />
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="enabled" label="启用" width="80">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" min-width="360" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDag(row.workflowCode)"
                >DAG</el-button
              >
              <el-button
                size="small"
                plain
                :type="row.enabled ? 'warning' : 'success'"
                :loading="actingIds.has(row.id)"
                @click="toggleRow(row)"
              >
                {{ row.enabled ? '停用' : '启用' }}
              </el-button>
              <el-button
                size="small"
                plain
                :loading="actingIds.has(row.id)"
                @click="validateRow(row)"
              >
                校验
              </el-button>
              <el-button size="small" plain @click="openDetail(row)">详情</el-button>
              <el-button
                size="small"
                plain
                type="danger"
                :loading="actingIds.has(row.id)"
                @click="removeRow(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="detailVisible" title="工作流详情 / 版本信息" size="760px">
      <el-descriptions v-if="detailRow" :column="2" border size="small">
        <el-descriptions-item label="workflowCode">{{
          detailRow.workflowCode
        }}</el-descriptions-item>
        <el-descriptions-item label="workflowName">{{
          detailRow.workflowName
        }}</el-descriptions-item>
        <el-descriptions-item label="workflowType">{{
          detailRow.workflowType
        }}</el-descriptions-item>
        <el-descriptions-item label="version">{{ detailRow.version }}</el-descriptions-item>
        <el-descriptions-item label="enabled">
          {{ detailRow.enabled ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="tenantId">{{ detailRow.tenantId }}</el-descriptions-item>
        <el-descriptions-item label="createdAt">{{
          detailRow.createdAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt">{{
          detailRow.updatedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="节点数">{{
          detailRow.nodes?.length ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item label="连线数">{{
          detailRow.edges?.length ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">
          <pre class="json-preview">{{ detailRow.description || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="nodes" :span="2">
          <pre class="json-preview">{{ JSON.stringify(detailRow.nodes ?? [], null, 2) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="edges" :span="2">
          <pre class="json-preview">{{ JSON.stringify(detailRow.edges ?? [], null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="validateVisible" title="工作流校验结果" width="720px">
      <pre class="json-preview">{{ validateResult }}</pre>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { workflowApi } from '@/api/workflow'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type {
    ConsoleWorkflowDefinitionResponse,
    WorkflowDefinitionDetailResponse,
  } from '@/types/console-api'

  const router = useRouter()
  const tenant = useTenantStore()

  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const allRows = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const actingIds = ref<Set<number>>(new Set())
  const detailVisible = ref(false)
  const detailRow = ref<WorkflowDefinitionDetailResponse | null>(null)
  const validateVisible = ref(false)
  const validateResult = ref('')
  const filters = reactive({
    tenantId: tenant.tenantId,
    workflowCode: '',
    workflowName: '',
    enabled: undefined as boolean | undefined,
    workflowType: '',
    version: undefined as number | undefined,
  })

  const workflowTypeOptions = computed(() =>
    Array.from(
      new Set(
        allRows.value.map((row) => row.workflowType).filter((item): item is string => !!item),
      ),
    ),
  )

  function openDag(workflowCode: string) {
    void router.push({ path: `/workflow/designer/${encodeURIComponent(workflowCode)}` })
  }

  async function load() {
    loading.value = true
    try {
      // listDefinitions 内部已做全量拉取 + 过滤 + 分页，直接使用结果
      const result = await workflowApi.listDefinitions({
        tenantId: filters.tenantId || tenant.tenantId,
        workflowCode: filters.workflowCode.trim() || undefined,
        workflowName: filters.workflowName.trim() || undefined,
        enabled: filters.enabled,
        workflowType: filters.workflowType.trim() || undefined,
        version: filters.version,
        page: page.value,
        pageSize: pageSize.value,
      })
      // allItems 是过滤前的全量数据，用于提取类型选项
      allRows.value = result.allItems
      rows.value = result.records
      total.value = result.total
    } finally {
      loading.value = false
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
      filters.version = undefined
      page.value = 1
      await load()
    })
  }

  async function openDetail(row: ConsoleWorkflowDefinitionResponse) {
    detailRow.value = await workflowApi.detailById(row.id, tenant.tenantId)
    detailVisible.value = true
  }

  async function toggleRow(row: ConsoleWorkflowDefinitionResponse) {
    try {
      await ElMessageBox.confirm(
        `${row.enabled ? '停用' : '启用'} Workflow「${row.workflowCode}」？`,
        '状态切换确认',
        { type: 'warning' },
      )
    } catch {
      return
    }
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      await workflowApi.toggle(row.id, tenant.tenantId, !row.enabled)
      ElMessage.success(`已${row.enabled ? '停用' : '启用'} ${row.workflowCode}`)
      await load()
    } finally {
      actingIds.value = new Set([...actingIds.value].filter((id) => id !== row.id))
    }
  }

  async function validateRow(row: ConsoleWorkflowDefinitionResponse) {
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      const result = await workflowApi.validate(row.id, tenant.tenantId)
      validateResult.value = JSON.stringify(result ?? {}, null, 2)
      validateVisible.value = true
    } finally {
      actingIds.value = new Set([...actingIds.value].filter((id) => id !== row.id))
    }
  }

  async function removeRow(row: ConsoleWorkflowDefinitionResponse) {
    try {
      await ElMessageBox.confirm(`删除 Workflow「${row.workflowCode}」？`, '删除确认', {
        type: 'warning',
      })
    } catch {
      return
    }
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      await workflowApi.toggle(row.id, tenant.tenantId, false)
      ElMessage.success(`已禁用 ${row.workflowCode}`)
      if (rows.value.length === 1 && page.value > 1) {
        page.value -= 1
      }
      await load()
    } finally {
      actingIds.value = new Set([...actingIds.value].filter((id) => id !== row.id))
    }
  }

  useSseAutoReload({
    domain: 'workflow-definitions',
    reload: load,
    scope: () => tenant.tenantId,
  })

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>

<style scoped></style>
