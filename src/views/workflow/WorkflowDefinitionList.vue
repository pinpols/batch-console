<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="goCreate">
          {{ t('workflowDefinitionList.headerCreate') }}
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
            <el-form-item :label="t('workflowDefinitionList.codeLabel')">
              <el-input
                class="query-w-160"
                v-model="filters.workflowCode"
                clearable
                :placeholder="t('workflowDefinitionList.codePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('workflowDefinitionList.nameLabel')">
              <el-input
                class="query-w-160"
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

        <el-table-column
          prop="workflowCode"
          :label="t('workflowDefinitionList.colCode')"
          width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="workflowName"
          :label="t('workflowDefinitionList.colName')"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          prop="workflowType"
          :label="t('workflowDefinitionList.colType')"
          width="120"
        >
          <template #default="{ row }">
            {{ resolveEnumLabel('workflowType', row.workflowType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="version"
          :label="t('workflowDefinitionList.colVersion')"
          width="80"
          align="right"
        />
        <el-table-column
          prop="description"
          :label="t('workflowDefinitionList.colDescription')"
          min-width="320"
          show-overflow-tooltip
        />
        <el-table-column prop="enabled" :label="t('workflowDefinitionList.colEnabled')" width="80">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <DatetimeColumn
          prop="updatedAt"
          :label="t('workflowDefinitionList.colUpdatedAt')"
          width="180"
        />
        <el-table-column :label="t('workflowDefinitionList.colActions')" width="200" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" />
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      v-model="detailVisible"
      :title="t('workflowDefinitionList.detailTitle')"
      size="800px"
    >
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
          {{ detailRow.enabled ? t('common.yes') : t('common.no') }}
        </el-descriptions-item>
        <el-descriptions-item label="tenantId">{{ detailRow.tenantId }}</el-descriptions-item>
        <el-descriptions-item label="createdAt">{{
          detailRow.createdAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt">{{
          detailRow.updatedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workflowDefinitionList.detailNodes')">{{
          detailRow.nodes?.length ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workflowDefinitionList.detailEdges')">{{
          detailRow.edges?.length ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workflowDefinitionList.detailDescription')" :span="2">
          <JsonPreview :data="detailRow.description || '—'" />
        </el-descriptions-item>
        <el-descriptions-item label="nodes" :span="2">
          <JsonPreview :data="detailRow.nodes ?? []" />
        </el-descriptions-item>
        <el-descriptions-item label="edges" :span="2">
          <JsonPreview :data="detailRow.edges ?? []" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog
      v-model="validateVisible"
      :title="t('workflowDefinitionList.validateTitle')"
      width="800px"
    >
      <JsonPreview :data="validateResult" />
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { confirmDanger } from '@/composables/useDangerConfirm'
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
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import type {
    ConsoleWorkflowDefinitionResponse,
    WorkflowDefinitionDetailResponse,
  } from '@/types/console-api'

  const router = useRouter()
  const tenant = useTenantStore()

  const loading = ref(false)
  const loadError = ref<unknown>(null)
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

  // workflowType 走后端 enum,完整候选不依赖列表先加载;rows 派生作 fallback
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const workflowTypeOptions = computed(() => {
    const fromEnum = pickMetaEnumGroup(metaEnums.value, 'workflowType')
    if (fromEnum.length > 0) return fromEnum
    return Array.from(
      new Set(
        allRows.value.map((row) => row.workflowType).filter((item): item is string => !!item),
      ),
    ).map((v) => ({ value: v, label: v }))
  })
  function openDag(workflowCode: string) {
    void router.push({ path: `/workflow/designer/${encodeURIComponent(workflowCode)}` })
  }

  /** 新建走 designer 的空白模式;由用户填 code/name/type 后提交 */
  function goCreate() {
    void router.push({ path: '/workflow/designer', query: { mode: 'create' } })
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
        onClick: () => openDag(row.workflowCode),
      },
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
        label: row.enabled
          ? t('workflowDefinitionList.actionDisable')
          : t('workflowDefinitionList.actionEnable'),
        loading: actingIds.value.has(row.id),
        onClick: () => toggleRow(row),
      },
      {
        key: 'archive',
        label: t('workflowDefinitionList.actionArchive'),
        danger: true,
        divided: true,
        disabled: !row.enabled, // 已禁用的不再让点
        loading: actingIds.value.has(row.id),
        onClick: () => removeRow(row),
      },
    ]
  }

  async function load() {
    loading.value = true
    loadError.value = null
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
    } catch (err) {
      loadError.value = err
      throw err
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
    // 用 row.tenantId 而非 tenant.tenantId,避免租户切换 race 时跨租户 404
    // (BE 防跨租户泄漏,row 来自 ta 但 store 已切 tb → 用 tb 查 ta 的 id → 404)
    detailRow.value = await workflowApi.detailById(row.id, row.tenantId ?? tenant.tenantId)
    detailVisible.value = true
  }

  async function toggleRow(row: ConsoleWorkflowDefinitionResponse) {
    try {
      const action = row.enabled
        ? t('workflowDefinitionList.actionDisable')
        : t('workflowDefinitionList.actionEnable')
      await ElMessageBox.confirm(
        t('workflowDefinitionList.toggleConfirmText', { action, code: row.workflowCode }),
        t('workflowDefinitionList.toggleConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
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
      actingIds.value = new Set([...actingIds.value].filter((id) => id !== row.id))
    }
  }

  async function validateRow(row: ConsoleWorkflowDefinitionResponse) {
    actingIds.value = new Set([...actingIds.value, row.id])
    try {
      const result = await workflowApi.validate(row.id, row.tenantId ?? tenant.tenantId)
      validateResult.value = JSON.stringify(result ?? {}, null, 2)
      validateVisible.value = true
    } finally {
      actingIds.value = new Set([...actingIds.value].filter((id) => id !== row.id))
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
