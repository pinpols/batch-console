<template>
  <PageContainer>
    <PageHeader
      title="流水线观测"
      description="file-pipelines / steps / dispatches / errors — 端上拉全量分页数据后按关键字筛选再分页（数据量大时首次加载可能较慢）。"
    />

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        v-hover-tab-activate="true"
        class="pill-tabs"
        @tab-change="onTabChange"
      >
        <el-tab-pane label="流水线实例" name="pipelines">
          <ProTable
            :data="pipelineRows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="onReset"
                @refresh="reloadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    placeholder="Job / 类型 / 状态 / Trace / fileId"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" label="ID" width="88" />
            <el-table-column prop="jobCode" label="Job" width="140" show-overflow-tooltip />
            <el-table-column prop="pipelineType" label="类型" width="110" />
            <el-table-column prop="runStatus" label="状态" width="120">
              <template #default="{ row }">
                <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
              </template>
            </el-table-column>
            <el-table-column
              prop="currentStage"
              label="当前阶段"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column prop="fileId" label="fileId" width="88" />
            <el-table-column prop="traceId" label="Trace" min-width="120" show-overflow-tooltip />
            <DatetimeColumn prop="startedAt" label="开始" width="160" />
            <DatetimeColumn prop="finishedAt" label="结束" width="160" />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane label="步骤" name="steps">
          <ProTable
            :data="stepRows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="onReset"
                @refresh="reloadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    placeholder="步骤 / 阶段 / 状态 / 错误 / 实例 Id"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" label="ID" width="88" />
            <el-table-column prop="pipelineInstanceId" label="流水线实例" width="120" />
            <el-table-column prop="stepCode" label="步骤" width="120" />
            <el-table-column prop="stageCode" label="阶段" width="120" />
            <el-table-column prop="stepStatus" label="状态" width="120">
              <template #default="{ row }">
                <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
              </template>
            </el-table-column>
            <el-table-column prop="retryCount" label="重试" width="72" />
            <el-table-column
              prop="errorMessage"
              label="错误"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="durationMs" label="耗时(ms)" width="100" />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane label="投递" name="dispatches">
          <ProTable
            :data="dispatchRows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="onReset"
                @refresh="reloadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    placeholder="fileId / 状态 / 渠道 / 外部请求 ID"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" label="ID" width="88" />
            <el-table-column prop="fileId" label="fileId" width="88" />
            <el-table-column prop="pipelineInstanceId" label="流水线" width="100" />
            <el-table-column prop="dispatchStatus" label="状态" width="120">
              <template #default="{ row }">
                <StatusTag
                  :value="String(row.dispatchStatus ?? '')"
                  category="outboxPublishStatus"
                />
              </template>
            </el-table-column>
            <el-table-column prop="channelCode" label="渠道" width="120" show-overflow-tooltip />
            <el-table-column
              prop="externalRequestId"
              label="外部请求 ID"
              min-width="140"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="createdAt" label="创建" width="160" />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane label="错单" name="errors">
          <ProTable
            :data="errorRows"
            :loading="tableBlocking"
            :total="total"
            v-model:page="page"
            v-model:page-size="pageSize"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="queryActionBusy"
                :refresh-busy="loading"
                :disabled="loading"
                @search="onSearch"
                @reset="onReset"
                @refresh="reloadTab"
              >
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    placeholder="fileId / 错误码 / 阶段 / 信息"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" label="ID" width="88" />
            <el-table-column prop="fileId" label="fileId" width="88" />
            <el-table-column prop="errorCode" label="码" width="120" />
            <el-table-column prop="errorStage" label="阶段" width="100" />
            <el-table-column
              prop="errorMessage"
              label="信息"
              min-width="200"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type {
    ConsoleFileDispatchRecordResponse,
    ConsoleFileErrorRecordResponse,
    ConsoleFilePipelineResponse,
    ConsoleFilePipelineStepResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const activeTab = ref<'pipelines' | 'steps' | 'dispatches' | 'errors'>('pipelines')
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const kwApplied = ref('')

  const allPipelines = ref<ConsoleFilePipelineResponse[]>([])
  const allSteps = ref<ConsoleFilePipelineStepResponse[]>([])
  const allDispatches = ref<ConsoleFileDispatchRecordResponse[]>([])
  const allErrors = ref<ConsoleFileErrorRecordResponse[]>([])

  const filteredPipelines = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allPipelines.value
    return allPipelines.value.filter((row) =>
      `${row.jobCode} ${row.pipelineType} ${row.runStatus} ${row.traceId} ${row.fileId} ${row.currentStage ?? ''}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredSteps = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allSteps.value
    return allSteps.value.filter((row) =>
      `${row.stepCode} ${row.stageCode} ${row.stepStatus} ${row.errorMessage ?? ''} ${row.pipelineInstanceId}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredDispatches = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allDispatches.value
    return allDispatches.value.filter((row) =>
      `${row.fileId} ${row.dispatchStatus} ${row.channelCode} ${row.externalRequestId ?? ''} ${row.pipelineInstanceId}`
        .toLowerCase()
        .includes(k),
    )
  })

  const filteredErrors = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    if (!k) return allErrors.value
    return allErrors.value.filter((row) =>
      `${row.fileId} ${row.errorCode} ${row.errorStage} ${row.errorMessage ?? ''}`
        .toLowerCase()
        .includes(k),
    )
  })

  const total = computed(() => {
    if (activeTab.value === 'pipelines') return filteredPipelines.value.length
    if (activeTab.value === 'steps') return filteredSteps.value.length
    if (activeTab.value === 'dispatches') return filteredDispatches.value.length
    return filteredErrors.value.length
  })

  const pipelineRows = computed(() => {
    const pr = toPageResult(filteredPipelines.value, page.value, pageSize.value)
    return pr.records
  })

  const stepRows = computed(() => {
    const pr = toPageResult(filteredSteps.value, page.value, pageSize.value)
    return pr.records
  })

  const dispatchRows = computed(() => {
    const pr = toPageResult(filteredDispatches.value, page.value, pageSize.value)
    return pr.records
  })

  const errorRows = computed(() => {
    const pr = toPageResult(filteredErrors.value, page.value, pageSize.value)
    return pr.records
  })

  function onSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      page.value = 1
    })
  }

  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      kwApplied.value = ''
      page.value = 1
    })
  }

  async function loadPipelines() {
    loading.value = true
    try {
      allPipelines.value = await fetchAllPageItems<ConsoleFilePipelineResponse>(
        '/api/console/queries/file-pipelines',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  async function loadSteps() {
    loading.value = true
    try {
      allSteps.value = await fetchAllPageItems<ConsoleFilePipelineStepResponse>(
        '/api/console/queries/file-pipeline-steps',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  async function loadDispatches() {
    loading.value = true
    try {
      allDispatches.value = await fetchAllPageItems<ConsoleFileDispatchRecordResponse>(
        '/api/console/queries/file-dispatches',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  async function loadErrors() {
    loading.value = true
    try {
      allErrors.value = await fetchAllPageItems<ConsoleFileErrorRecordResponse>(
        '/api/console/queries/file-errors',
        { tenantId: tenant.tenantId },
      )
    } finally {
      loading.value = false
    }
  }

  function reloadTab() {
    page.value = 1
    void runActive()
  }

  function onTabChange() {
    page.value = 1
    kwDraft.value = ''
    kwApplied.value = ''
    void runActive()
  }

  async function runActive() {
    if (activeTab.value === 'pipelines') await loadPipelines()
    else if (activeTab.value === 'steps') await loadSteps()
    else if (activeTab.value === 'dispatches') await loadDispatches()
    else await loadErrors()
  }

  useTenantReload(() => {
    page.value = 1
    void runActive()
  })
</script>
