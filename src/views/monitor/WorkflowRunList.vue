<template>
  <PageContainer>
    <PageHeader
      title="Workflow Run 列表"
      description="分页接口拉取运行记录；Workflow 编码从当前租户下的定义列表选择（无单独枚举接口）。"
    />

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
            @search="search"
            @reset="resetQueryBar"
            @refresh="load"
          >
            <el-form-item label="租户">
              <TenantSelect
                v-model="filterTenantId"
                placeholder="按租户过滤"
                size="default"
                select-class="query-w-180"
              />
            </el-form-item>
            <el-form-item label="Workflow">
              <el-select
                class="query-w-200"
                v-model="workflowCode"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 workflowCode"
              >
                <el-option
                  v-for="code in workflowCodeOptions"
                  :key="code"
                  :label="code"
                  :value="code"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-200"
                v-model="runStatus"
                clearable
                filterable
                placeholder="全部运行状态"
              >
                <el-option
                  v-for="opt in runStatusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="id" label="Run Id" width="90">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/workflow-runs/${row.id}`">
              {{ row.id }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="workflowDefinitionId" label="Def Id" width="90" />
        <el-table-column prop="runStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
          </template>
        </el-table-column>
        <el-table-column
          prop="currentNodeCode"
          label="当前节点"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column prop="bizDate" label="业务日" width="110" />
        <el-table-column prop="traceId" label="Trace" min-width="120">
          <template #default="{ row }">
            <CopyableText v-if="row.traceId" :text="row.traceId" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="startedAt" label="开始" width="160" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                @click="goDetail(row as ConsoleWorkflowRunResponse)"
              >
                详情
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
  import { instanceApi } from '@/api/instance'
  import { queryWorkflowDefinitions } from '@/api/workflowQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import type { ConsoleWorkflowRunResponse } from '@/types/console-api'

  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleWorkflowRunResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const filterTenantId = ref(tenant.tenantId)
  const workflowCode = ref('')
  const runStatus = ref('')
  const workflowCodeOptions = ref<string[]>([])
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const runStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'workflowRunStatus'))

  /** 缓存定义列表，避免每次 load 都重新拉取 */
  const cachedDefs = ref<Awaited<ReturnType<typeof queryWorkflowDefinitions>>>([])

  const tableRows = computed(() => rows.value as unknown as Record<string, unknown>[])

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

  async function load() {
    loading.value = true
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
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } finally {
      loading.value = false
    }
  }

  function search() {
    page.value = 1
    load()
  }

  function resetQueryBar() {
    filterTenantId.value = tenant.tenantId
    workflowCode.value = ''
    runStatus.value = ''
    page.value = 1
    load()
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
