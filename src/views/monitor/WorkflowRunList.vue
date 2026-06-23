<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
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
                :placeholder="t('monitor.runListTraceIdPlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('monitor.runListEmptyTitle')"
            :description="t('monitor.runListEmptyDescription')"
            :image-size="80"
          >
            <template #action>
              <el-button type="primary" @click="$router.push('/workflow/definitions')">
                {{ t('monitor.runListEmptyGoDefinitions') }}
              </el-button>
            </template>
          </EmptyState>
        </template>

        <el-table-column prop="id" :label="t('monitor.runColRunId')" width="90">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/workflow-runs/${row.id}`">
              {{ row.id }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="workflowDefinitionId" :label="t('monitor.runColDefId')" width="90" />
        <el-table-column prop="runStatus" :label="t('monitor.runColStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
          </template>
        </el-table-column>
        <el-table-column
          prop="currentNodeCode"
          :label="t('monitor.runColCurrentNode')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column prop="bizDate" :label="t('monitor.runColBizDate')" width="110" />
        <el-table-column prop="traceId" :label="t('monitor.runColTrace')" min-width="120">
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="startedAt" :label="t('monitor.runColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.runColFinished')" width="160" />
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
                @click="goDetail(row as ConsoleWorkflowRunResponse)"
              >
                {{ t('monitor.runActionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { instanceApi } from '@/api/instance'
  import { queryWorkflowDefinitions } from '@/api/workflowQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
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
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleWorkflowRunResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const workflowCode = ref('')
  const runStatus = ref('')
  const traceId = ref('')
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

  async function loadWorkflowCodes() {
    try {
      cachedDefs.value = await queryWorkflowDefinitions(tenant.tenantId)
      workflowCodeOptions.value = [
        ...new Set(cachedDefs.value.map((d) => d.workflowCode).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b))
    } catch {
      cachedDefs.value = []
      workflowCodeOptions.value = []
    }
  }

  function resolveDefId(): number | undefined {
    const code = workflowCode.value.trim()
    if (!code) return undefined
    const hit = cachedDefs.value.find((d) => d.workflowCode === code)
    return hit?.id
  }

  const loadError = ref<unknown>(null)
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const defId = resolveDefId()
      const code = workflowCode.value.trim()
      if (code && defId === undefined) {
        rows.value = []
        total.value = 0
        return
      }
      const pr = await instanceApi.workflowRuns({
        tenantId: tenant.tenantId,
        workflowDefinitionId: defId,
        runStatus: runStatus.value.trim() || undefined,
        traceId: traceId.value.trim() || undefined,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
      live.markRefreshed()
    }
  }

  function search() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

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

  useTenantReload(() => {
    page.value = 1
    void loadWorkflowCodes()
    void load()
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
  onMounted(() => {
    const q = route.query
    if (q.workflowCode) workflowCode.value = String(q.workflowCode)
    if (q.status) runStatus.value = String(q.status)
    if (q.traceId) traceId.value = String(q.traceId)
    if (q.page) {
      const p = Number(q.page)
      if (Number.isFinite(p) && p > 0) page.value = p
    }
    if (q.pageSize) {
      const ps = Number(q.pageSize)
      if (Number.isFinite(ps) && ps > 0) pageSize.value = ps
    }
  })
  watch([workflowCode, runStatus, traceId, page, pageSize], syncFiltersToUrl)
</script>
