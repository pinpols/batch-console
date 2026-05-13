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
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="search"
            @reset="resetQueryBar"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('monitor.runListTenantLabel')">
              <TenantSelect
                v-model="filterTenantId"
                :placeholder="t('monitor.runListTenantPlaceholder')"
                size="default"
                select-class="query-w-180"
              />
            </el-form-item>
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
              <el-input
                class="query-w-240"
                v-model="traceId"
                clearable
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
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
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
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import type { ConsoleWorkflowRunResponse } from '@/types/console-api'

  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const rows = ref<ConsoleWorkflowRunResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const filterTenantId = ref(tenant.tenantId)
  const workflowCode = ref('')
  const runStatus = ref('')
  const traceId = ref('')
  const workflowCodeOptions = ref<string[]>([])
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const runStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'workflowRunStatus'))

  /** 缓存定义列表，避免每次 load 都重新拉取 */
  const cachedDefs = ref<Awaited<ReturnType<typeof queryWorkflowDefinitions>>>([])

  async function loadWorkflowCodes() {
    try {
      cachedDefs.value = await queryWorkflowDefinitions(filterTenantId.value || tenant.tenantId)
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
        tenantId: filterTenantId.value || tenant.tenantId,
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
      filterTenantId.value = tenant.tenantId
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

  useSseAutoReload({
    domain: 'workflow-runs',
    reload: load,
    scope: () => tenant.tenantId,
  })

  useTenantReload(() => {
    page.value = 1
    void loadWorkflowCodes()
    void load()
  })
</script>
