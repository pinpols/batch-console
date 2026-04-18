<template>
  <PageContainer>
    <PageHeader
      title="可观测性查询"
      description="Dead Letters、重试调度、执行日志、Channel 回执查询。"
    />

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        v-hover-tab-activate="true"
        class="pill-tabs"
        @tab-change="onTabChange"
      >
        <!-- Dead Letters -->
        <el-tab-pane label="Dead Letters" name="deadLetters">
          <div class="section-toolbar">
            <el-button :loading="loadingDL" @click="loadDeadLetters">刷新</el-button>
          </div>
          <el-table
            :data="pagedDL.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="sourceType" label="来源类型" width="120" />
            <el-table-column prop="sourceId" label="来源 ID" width="100" />
            <el-table-column
              prop="deadLetterReason"
              label="原因"
              min-width="250"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="createdAt" label="失败时间" width="160" />
            <el-table-column prop="replayCount" label="重试次数" width="90" />
            <el-table-column prop="replayStatus" label="状态" width="100" />
          </el-table>
          <TablePagerBar
            :page="dlPage"
            :page-size="dlPageSize"
            :total="pagedDL.total"
            @update:page="(p: number) => (dlPage = p)"
            @update:page-size="
              (s: number) => {
                dlPageSize = s
                dlPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Retries -->
        <el-tab-pane label="重试调度" name="retries">
          <div class="section-toolbar">
            <el-button :loading="loadingRetry" @click="loadRetries">刷新</el-button>
          </div>
          <el-table
            :data="pagedRetries.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="relatedType" label="关联类型" width="120" />
            <el-table-column prop="relatedId" label="关联 ID" width="100" />
            <el-table-column prop="retryStatus" label="状态" width="120" />
            <DatetimeColumn prop="nextRetryAt" label="下次重试" width="160" />
            <el-table-column prop="retryCount" label="重试次数" width="90" />
            <el-table-column prop="maxRetryCount" label="最大重试" width="90" />
            <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
          </el-table>
          <TablePagerBar
            :page="retryPage"
            :page-size="retryPageSize"
            :total="pagedRetries.total"
            @update:page="(p: number) => (retryPage = p)"
            @update:page-size="
              (s: number) => {
                retryPageSize = s
                retryPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Execution Logs -->
        <el-tab-pane label="执行日志" name="executionLogs">
          <div class="section-toolbar">
            <el-button :loading="loadingExec" @click="loadExecutionLogs">刷新</el-button>
          </div>
          <el-table
            :data="pagedExec.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="operationType" label="操作类型" width="140" />
            <el-table-column prop="operationResult" label="结果" width="100" />
            <el-table-column prop="operatorId" label="操作人" width="140" show-overflow-tooltip />
            <el-table-column
              prop="detailSummary"
              label="摘要"
              min-width="300"
              show-overflow-tooltip
            />
            <el-table-column prop="traceId" label="Trace ID" width="180" show-overflow-tooltip />
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
          </el-table>
          <TablePagerBar
            :page="execPage"
            :page-size="execPageSize"
            :total="pagedExec.total"
            @update:page="(p: number) => (execPage = p)"
            @update:page-size="
              (s: number) => {
                execPageSize = s
                execPage = 1
              }
            "
          />
        </el-tab-pane>

        <!-- Channel Receipts -->
        <el-tab-pane label="Channel 回执" name="channelReceipts">
          <div class="section-toolbar">
            <el-button :loading="loadingReceipts" @click="loadChannelReceipts">刷新</el-button>
          </div>
          <el-table
            :data="pagedReceipts.records"
            stripe
            border
            empty-text="暂无数据"
            size="small"
            class="console-table"
          >
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column
              prop="channelCode"
              label="渠道"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column prop="fileId" label="文件 ID" width="100" />
            <el-table-column prop="dispatchStatus" label="投递状态" width="100" />
            <el-table-column prop="receiptStatus" label="回执状态" width="100" />
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="250"
              show-overflow-tooltip
            />
            <DatetimeColumn prop="dispatchedAt" label="投递时间" width="160" />
          </el-table>
          <TablePagerBar
            :page="receiptPage"
            :page-size="receiptPageSize"
            :total="pagedReceipts.total"
            @update:page="(p: number) => (receiptPage = p)"
            @update:page-size="
              (s: number) => {
                receiptPageSize = s
                receiptPage = 1
              }
            "
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    queryDeadLetters,
    queryRetries,
    queryExecutionLogs,
    queryChannelReceipts,
  } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'

  const tenant = useTenantStore()
  const activeTab = ref('deadLetters')

  const loadingDL = ref(false)
  const loadingRetry = ref(false)
  const loadingExec = ref(false)
  const loadingReceipts = ref(false)

  const dlRows = ref<Record<string, unknown>[]>([])
  const dlPage = ref(1)
  const dlPageSize = ref(20)
  const pagedDL = computed(() => toPageResult(dlRows.value, dlPage.value, dlPageSize.value))

  const retryRows = ref<Record<string, unknown>[]>([])
  const retryPage = ref(1)
  const retryPageSize = ref(20)
  const pagedRetries = computed(() =>
    toPageResult(retryRows.value, retryPage.value, retryPageSize.value),
  )

  const execRows = ref<Record<string, unknown>[]>([])
  const execPage = ref(1)
  const execPageSize = ref(20)
  const pagedExec = computed(() => toPageResult(execRows.value, execPage.value, execPageSize.value))

  const receiptRows = ref<Record<string, unknown>[]>([])
  const receiptPage = ref(1)
  const receiptPageSize = ref(20)
  const pagedReceipts = computed(() =>
    toPageResult(receiptRows.value, receiptPage.value, receiptPageSize.value),
  )

  async function loadDeadLetters() {
    loadingDL.value = true
    try {
      dlRows.value = (await queryDeadLetters(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      dlRows.value = []
    } finally {
      loadingDL.value = false
    }
  }

  async function loadRetries() {
    loadingRetry.value = true
    try {
      retryRows.value = (await queryRetries(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      retryRows.value = []
    } finally {
      loadingRetry.value = false
    }
  }

  async function loadExecutionLogs() {
    loadingExec.value = true
    try {
      execRows.value = (await queryExecutionLogs(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      execRows.value = []
    } finally {
      loadingExec.value = false
    }
  }

  async function loadChannelReceipts() {
    loadingReceipts.value = true
    try {
      receiptRows.value = (await queryChannelReceipts(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      receiptRows.value = []
    } finally {
      loadingReceipts.value = false
    }
  }

  function onTabChange(tab: string | number) {
    const name = String(tab)
    if (name === 'deadLetters' && !dlRows.value.length) void loadDeadLetters()
    if (name === 'retries' && !retryRows.value.length) void loadRetries()
    if (name === 'executionLogs' && !execRows.value.length) void loadExecutionLogs()
    if (name === 'channelReceipts' && !receiptRows.value.length) void loadChannelReceipts()
  }

  function loadAll() {
    dlPage.value = 1
    retryPage.value = 1
    execPage.value = 1
    receiptPage.value = 1
    void loadDeadLetters()
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
