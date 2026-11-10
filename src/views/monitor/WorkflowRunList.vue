<template>
  <PageContainer>
    <PageHeader />

    <div>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :error="loadError"
        :on-retry="load"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
      >
        <template #toolbar>
          <OpsListToolbar
            :status="live.status.value"
            :last-refreshed-at="live.lastRefreshedAt.value"
          />
        </template>

        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="search"
            @reset="resetQueryBar"
            @refresh="() => runRefresh(load)"
          >
            <template #prepend>
              <SavedFiltersMenu
                :sets="savedFilters.sets.value"
                :on-save="savedFilters.save"
                :on-apply="savedFilters.applySet"
                :on-remove="savedFilters.remove"
                :on-rename="savedFilters.rename"
                :on-export="savedFilters.exportSets"
                :on-import="savedFilters.importSets"
              />
            </template>
            <el-form-item :label="t('monitor.runListWorkflowLabel')">
              <el-select
                class="query-w-200"
                v-model="workflowCode"
                clearable
                filterable
                allow-create
                default-first-option
                :placeholder="t('monitor.runListWorkflowPlaceholder')"
              >
                <el-option
                  v-for="code in workflowCodeOptions"
                  :key="code"
                  :label="code"
                  :value="code"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('monitor.runListStatusLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="runStatus"
                clearable
                filterable
                enum-key="workflowRunStatus"
                :placeholder="t('monitor.runListStatusPlaceholder')"
                :options="runStatusOptions"
              />
            </el-form-item>
            <el-form-item :label="t('monitor.runListTraceIdLabel')">
              <TraceIdInput
                class="query-w-240"
                v-model="traceId"
                :go-to="false"
                :placeholder="t('monitor.runListTraceIdPlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #empty>
          <ListEmptyState
            :filtered="hasRunFilters"
            @reset="resetQueryBar"
            :title="t('monitor.runListEmptyTitle')"
            :description="t('monitor.runListEmptyDescription')"
            :action-text="t('monitor.runListEmptyGoDefinitions')"
            action-to="/workflow/definitions"
          />
        </template>

        <el-table-column prop="id" :label="t('monitor.runColRunId')" width="90">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/workflow-runs/${row.id}`">
              {{ row.id }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column
          prop="workflowDefinitionId"
          :label="t('monitor.runColWorkflow')"
          min-width="200"
        >
          <template #default="{ row }">
            <div class="wf-cell">
              <span class="wf-cell__name">{{
                definitionById.get(row.workflowDefinitionId)?.workflowName ??
                `#${row.workflowDefinitionId}`
              }}</span>
              <span v-if="definitionById.get(row.workflowDefinitionId)" class="wf-cell__code"
                >{{ definitionById.get(row.workflowDefinitionId)?.workflowCode }} · #{{
                  row.workflowDefinitionId
                }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="runStatus" :label="t('monitor.runColStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
          </template>
        </el-table-column>
        <el-table-column prop="currentNodeCode" :label="t('monitor.runColCurrentNode')" width="140">
          <template #default="{ row }">
            <CopyableText v-if="row.currentNodeCode" :text="String(row.currentNodeCode)" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="bizDate" :label="t('monitor.runColBizDate')" width="110" />
        <el-table-column prop="traceId" :label="t('monitor.runColTrace')" min-width="120">
          <template #default="{ row }">
            <span v-if="row.traceId" class="trace-cell">
              <router-link
                class="cell-link trace-cell__link"
                :to="`/observability/trace?traceId=${row.traceId}`"
              >
                {{ row.traceId }}
              </router-link>
              <CopyableText :text="String(row.traceId)" icon-only />
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="startedAt" :label="t('monitor.runColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.runColFinished')" width="160" />
        <el-table-column :label="t('monitor.runColDuration')" width="100">
          <template #default="{ row }">{{
            runDuration(row as ConsoleWorkflowRunResponse)
          }}</template>
        </el-table-column>
        <el-table-column
          prop="relatedJobInstanceId"
          :label="t('monitor.runColRelated')"
          width="100"
        >
          <template #default="{ row }">
            <router-link
              v-if="row.relatedJobInstanceId"
              class="cell-link"
              :to="`/monitor/job-instances/${row.relatedJobInstanceId}`"
              >{{ row.relatedJobInstanceId }}</router-link
            >
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('monitor.runColActions')" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                :icon="Eye"
                @click="goDetail(row as ConsoleWorkflowRunResponse)"
              >
                {{ t('monitor.runActionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { Eye } from '@lucide/vue'
  import { ref, computed, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { instanceApi } from '@/api/instance'
  import { queryWorkflowDefinitions } from '@/api/workflowQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { fmtDuration } from '@/utils/datetime'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListEmptyState from '@/components/common/ListEmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import SavedFiltersMenu from '@/components/table/SavedFiltersMenu.vue'
  import { useSavedFilters } from '@/composables/useSavedFilters'
  import { useAuthStore } from '@/stores/auth'
  import ProTable from '@/components/table/ProTable.vue'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleWorkflowRunResponse } from '@/types/console-api'

  const router = useRouter()
  const route = useRoute()
  const tenant = useTenantStore()
  const listScope = useTenantRequestScope()
  const codesScope = useTenantRequestScope()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleWorkflowRunResponse[]>([])
  const total = ref(0)
  function positiveQueryNumber(value: unknown, fallback: number) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
  }
  const page = ref(positiveQueryNumber(route.query.page, 1))
  const pageSize = ref(positiveQueryNumber(route.query.pageSize, 15))
  const workflowCode = ref(String(route.query.workflowCode ?? ''))
  const runStatus = ref(String(route.query.status ?? ''))
  const traceId = ref(String(route.query.traceId ?? ''))
  const workflowCodeOptions = ref<string[]>([])

  const auth = useAuthStore()
  const savedFilters = useSavedFilters({
    pageKey: 'workflow-runs',
    userId: () => auth.userInfo?.userId,
    getCurrent: () => ({
      workflowCode: workflowCode.value,
      runStatus: runStatus.value,
      traceId: traceId.value,
    }),
    apply: (f) => {
      workflowCode.value = String(f.workflowCode ?? '')
      runStatus.value = String(f.runStatus ?? '')
      traceId.value = String(f.traceId ?? '')
      page.value = 1
      void load()
    },
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const runStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'workflowRunStatus'))

  /** 缓存定义列表，避免每次 load 都重新拉取 */
  const cachedDefs = ref<Awaited<ReturnType<typeof queryWorkflowDefinitions>>>([])

  let definitionsTenant: string | null = null
  let definitionsRequest: Promise<void> | null = null
  let definitionsRequestTenant: string | null = null
  function loadWorkflowCodes(): Promise<void> {
    const tenantId = tenant.tenantId
    if (!tenantId || definitionsTenant === tenantId) return Promise.resolve()
    if (definitionsRequestTenant === tenantId && definitionsRequest) return definitionsRequest
    const scope = codesScope.begin()
    const request = (async () => {
      try {
        const definitions = await queryWorkflowDefinitions(tenantId)
        if (!codesScope.isCurrent(scope)) return
        cachedDefs.value = definitions
        const codes = definitions.map((definition) => definition.workflowCode).filter(Boolean)
        workflowCodeOptions.value = Array.from(new Set(codes)).sort((a, b) => a.localeCompare(b))
        definitionsTenant = tenantId
      } catch (error) {
        if (codesScope.isCurrent(scope)) {
          cachedDefs.value = []
          workflowCodeOptions.value = []
        }
        throw error
      } finally {
        if (codesScope.isCurrent(scope)) {
          definitionsRequest = null
          definitionsRequestTenant = null
        }
      }
    })()
    definitionsRequest = request
    definitionsRequestTenant = tenantId
    return request
  }

  /** 运行响应只有定义 ID；用已缓存的定义补出名称和编码，缺失时回落显示 ID */
  const definitionById = computed(
    () => new Map(cachedDefs.value.map((definition) => [definition.id, definition])),
  )

  function runDuration(row: ConsoleWorkflowRunResponse) {
    if (!row.startedAt) return '—'
    if (!row.finishedAt) return t('monitor.runDurationRunning')
    return fmtDuration(Date.parse(row.finishedAt) - Date.parse(row.startedAt))
  }

  const loadError = ref<unknown>(null)
  async function load() {
    const scope = listScope.begin()
    if (!scope.tenantId) return
    loading.value = true
    loadError.value = null
    try {
      // 名称列只依赖缓存，失败不影响运行列表和服务端编码筛选。
      void loadWorkflowCodes().catch(() => undefined)
      if (!listScope.isCurrent(scope)) return
      const code = workflowCode.value.trim()
      const pr = await instanceApi.workflowRuns({
        tenantId: scope.tenantId,
        workflowCode: code || undefined,
        runStatus: runStatus.value.trim() || undefined,
        traceId: traceId.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
      })
      if (!listScope.isCurrent(scope)) return
      rows.value = pr.records
      total.value = pr.total
      live.markRefreshed()
    } catch (err) {
      if (listScope.isCurrent(scope)) loadError.value = err
      throw err
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
    }
  }

  function search() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

  // 工作流 / 状态 / 链路任一筛选生效时，空表是筛选造成的
  const hasRunFilters = computed(() =>
    Boolean(workflowCode.value || runStatus.value || traceId.value),
  )

  function resetQueryBar() {
    return runReset(async () => {
      workflowCode.value = ''
      runStatus.value = ''
      traceId.value = ''
      page.value = 1
      await load()
    })
  }

  function goDetail(row: ConsoleWorkflowRunResponse) {
    router.push(`/monitor/workflow-runs/${row.id}`)
  }

  const live = useSseAutoReload({
    domain: 'workflow-runs',
    reload: load,
    scope: () => tenant.tenantId,
  })

  watch(
    () => tenant.tenantId,
    () => {
      page.value = 1
      rows.value = []
      total.value = 0
      cachedDefs.value = []
      workflowCodeOptions.value = []
      loading.value = false
      loadError.value = null
      definitionsTenant = null
      definitionsRequest = null
      definitionsRequestTenant = null
    },
    { flush: 'sync' },
  )
  useTenantReload(async () => {
    await Promise.all([loadWorkflowCodes(), load()])
  })

  // URL state:筛选 + 分页 round-trip,详情页 back 返回不丢上下文
  function syncFiltersToUrl() {
    const params: Record<string, string> = {}
    if (workflowCode.value) params.workflowCode = workflowCode.value
    if (runStatus.value) params.status = runStatus.value
    if (traceId.value) params.traceId = traceId.value
    if (page.value > 1) params.page = String(page.value)
    if (pageSize.value !== 15) params.pageSize = String(pageSize.value)
    void router.replace({ query: params })
  }
  watch([workflowCode, runStatus, traceId, page, pageSize], syncFiltersToUrl)
</script>

<style scoped>
  .wf-cell {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.35;
  }

  .wf-cell__name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wf-cell__code {
    overflow: hidden;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trace-cell {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .trace-cell__link {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
