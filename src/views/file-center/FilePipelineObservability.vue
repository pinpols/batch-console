<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" class="pill-tabs" @tab-change="onTabChange">
        <el-tab-pane :label="t('filePipelineObservability.tabPipelines')" name="pipelines">
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
                @refresh="() => runRefresh(reloadTab)"
              >
                <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    :placeholder="t('filePipelineObservability.pipelinesKw')"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
            <el-table-column
              prop="jobCode"
              :label="t('filePipelineObservability.colJob')"
              width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="pipelineType"
              :label="t('filePipelineObservability.colType')"
              width="110"
            />
            <el-table-column
              prop="runStatus"
              :label="t('filePipelineObservability.colStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag :value="String(row.runStatus ?? '')" category="workflow" />
              </template>
            </el-table-column>
            <el-table-column
              prop="currentStage"
              :label="t('filePipelineObservability.colCurrentStage')"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="lastSuccessStage"
              :label="t('filePipelineObservability.colLastSuccess')"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="fileId"
              :label="t('filePipelineObservability.colFileId')"
              width="88"
            >
              <template #default="{ row }">
                <router-link
                  v-if="row.fileId"
                  class="cell-link"
                  :to="`/files/list?fileId=${row.fileId}`"
                >
                  {{ row.fileId }}
                </router-link>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="relatedJobInstanceId"
              :label="t('filePipelineObservability.colRelatedInstance')"
              width="100"
            >
              <template #default="{ row }">
                <router-link
                  v-if="row.relatedJobInstanceId"
                  class="cell-link"
                  :to="`/monitor/job-instances/${row.relatedJobInstanceId}`"
                >
                  {{ row.relatedJobInstanceId }}
                </router-link>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="traceId"
              :label="t('filePipelineObservability.colTrace')"
              min-width="120"
              show-overflow-tooltip
            >
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
            <DatetimeColumn
              prop="startedAt"
              :label="t('filePipelineObservability.colStart')"
              width="160"
            />
            <DatetimeColumn
              prop="finishedAt"
              :label="t('filePipelineObservability.colFinish')"
              width="160"
            />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane :label="t('filePipelineObservability.tabSteps')" name="steps">
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
                @refresh="() => runRefresh(reloadTab)"
              >
                <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    :placeholder="t('filePipelineObservability.stepsKw')"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
            <el-table-column
              prop="pipelineInstanceId"
              :label="t('filePipelineObservability.colPipelineInstance')"
              width="120"
            />
            <el-table-column
              prop="stepCode"
              :label="t('filePipelineObservability.colStep')"
              width="120"
            />
            <el-table-column
              prop="stageCode"
              :label="t('filePipelineObservability.colStage')"
              width="120"
            />
            <el-table-column
              prop="runSeq"
              :label="t('filePipelineObservability.colSeq')"
              width="70"
              align="right"
            />
            <el-table-column
              prop="stepStatus"
              :label="t('filePipelineObservability.colStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
              </template>
            </el-table-column>
            <el-table-column
              prop="retryCount"
              :label="t('filePipelineObservability.colRetry')"
              width="72"
              align="right"
            />
            <DatetimeColumn
              prop="startedAt"
              :label="t('filePipelineObservability.colStart')"
              width="160"
            />
            <DatetimeColumn
              prop="finishedAt"
              :label="t('filePipelineObservability.colDone')"
              width="160"
            />
            <el-table-column
              :label="t('filePipelineObservability.colError')"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
                <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
                <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="durationMs"
              :label="t('filePipelineObservability.colDurationMs')"
              width="100"
              align="right"
            />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane :label="t('filePipelineObservability.tabDispatches')" name="dispatches">
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
                @refresh="() => runRefresh(reloadTab)"
              >
                <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    :placeholder="t('filePipelineObservability.dispatchesKw')"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
            <el-table-column
              prop="fileId"
              :label="t('filePipelineObservability.colFileId')"
              width="88"
            />
            <el-table-column
              prop="pipelineInstanceId"
              :label="t('filePipelineObservability.colPipeline')"
              width="100"
            />
            <el-table-column
              prop="dispatchStatus"
              :label="t('filePipelineObservability.colStatus')"
              width="120"
            >
              <template #default="{ row }">
                <StatusTag
                  :value="String(row.dispatchStatus ?? '')"
                  category="outboxPublishStatus"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="channelCode"
              :label="t('filePipelineObservability.colChannel')"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="dispatchTarget"
              :label="t('filePipelineObservability.colTarget')"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="dispatchAttempt"
              :label="t('filePipelineObservability.colAttempt')"
              width="70"
              align="right"
            />
            <el-table-column
              prop="receiptStatus"
              :label="t('filePipelineObservability.colReceipt')"
              width="100"
            />
            <el-table-column
              prop="receiptCode"
              :label="t('filePipelineObservability.colReceiptCode')"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="externalRequestId"
              :label="t('filePipelineObservability.colExternalReqId')"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              :label="t('filePipelineObservability.colError')"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
                <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
                <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
              </template>
            </el-table-column>
            <DatetimeColumn
              prop="dispatchedAt"
              :label="t('filePipelineObservability.colDispatchedAt')"
              width="160"
            />
            <DatetimeColumn
              prop="ackAt"
              :label="t('filePipelineObservability.colAckAt')"
              width="160"
            />
          </ProTable>
        </el-tab-pane>

        <el-tab-pane :label="t('filePipelineObservability.tabErrors')" name="errors">
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
                @refresh="() => runRefresh(reloadTab)"
              >
                <el-form-item :label="t('filePipelineObservability.keywordLabel')">
                  <el-input
                    class="query-w-280"
                    v-model="kwDraft"
                    clearable
                    :placeholder="t('filePipelineObservability.errorsKw')"
                    @keyup.enter="onSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="id" :label="t('filePipelineObservability.colId')" width="88" />
            <el-table-column
              prop="fileId"
              :label="t('filePipelineObservability.colFileId')"
              width="88"
            />
            <el-table-column
              prop="recordNo"
              :label="t('filePipelineObservability.colRecordNo')"
              width="80"
              align="right"
            />
            <el-table-column
              prop="errorCode"
              :label="t('filePipelineObservability.colErrorCode')"
              width="120"
            />
            <el-table-column
              prop="errorStage"
              :label="t('filePipelineObservability.colStage')"
              width="100"
            />
            <el-table-column
              prop="errorMessage"
              :label="t('filePipelineObservability.colErrorMessage')"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column :label="t('filePipelineObservability.colSkipped')" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.skipped" size="small" type="warning" effect="plain">
                  {{ t('filePipelineObservability.tagSkipped')
                  }}{{ row.skipAction ? `(${row.skipAction})` : '' }}
                </el-tag>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <DatetimeColumn
              prop="createdAt"
              :label="t('filePipelineObservability.colTime')"
              width="160"
            />
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'

  const { t } = useI18n({ useScope: 'global' })
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
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
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
