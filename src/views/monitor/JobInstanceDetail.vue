<template>
  <PageContainer>
    <PageHeader title="作业实例详情" :description="headerDesc" back-to="/monitor/job-instances">
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="row" type="danger" :loading="cancelLoading" @click="confirmCancel">
          取消实例
        </el-button>
      </template>
    </PageHeader>

    <div v-if="row" class="detail-grid">
      <MetricCard label="实例编号" :value="row.instanceNo" description="instanceNo" />
      <MetricCard label="状态" :value="row.instanceStatus" description="instanceStatus" />
      <MetricCard label="Job Code" :value="row.jobCode" description="jobCode" />
      <MetricCard label="业务日" :value="row.bizDate" description="bizDate" />
      <MetricCard label="Trace" :value="row.traceId || '—'" description="traceId" />
      <MetricCard label="队列" :value="row.queueCode || '—'" description="queueCode" />
    </div>

    <SectionCard v-if="row">
      <template #header>时间与 SLA</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="开始">{{ fmtDatetime(row.startedAt) }}</el-descriptions-item>
        <el-descriptions-item label="结束">{{ fmtDatetime(row.finishedAt) }}</el-descriptions-item>
        <el-descriptions-item label="截止">{{ fmtDatetime(row.deadlineAt) }}</el-descriptions-item>
        <el-descriptions-item label="SLA 告警时间">{{
          row.slaAlertedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="重跑">{{ row.rerunFlag ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="重试">{{ row.retryFlag ? '是' : '否' }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button type="primary" @click="goSteps">查看分片</el-button>
        <el-button @click="goLogs">执行日志（审计检索）</el-button>
        <el-button type="warning" :loading="rerunLoading" @click="confirmRerun">重跑</el-button>
        <el-button type="danger" :loading="cancelLoading" @click="confirmCancel"
          >取消实例</el-button
        >
        <el-button type="danger" :loading="terminateLoading" @click="confirmTerminate"
          >终止实例</el-button
        >
      </div>
    </SectionCard>

    <SectionCard v-if="row">
      <template #header>参数与结果摘要</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="paramsSnapshot">
          <pre class="mono">{{ row.paramsSnapshot || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="resultSummary">
          <pre class="mono">{{ row.resultSummary || '—' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </SectionCard>

    <SectionCard v-else-if="!loading">
      <EmptyState description="未找到该实例。请确认实例 ID 正确且属于当前租户。" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { instanceApi } from '@/api/instance'
  import { createLogStream } from '@/api/stream'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rerunLoading = ref(false)
  const cancelLoading = ref(false)
  const terminateLoading = ref(false)
  const row = ref<ConsoleJobInstanceResponse | null>(null)

  const instanceId = computed(() => Number(route.params.id))

  const headerDesc = computed(() => {
    if (!row.value) return '加载中...'
    return `${row.value.jobCode} · ${row.value.bizDate || ''}`
  })

  async function load() {
    if (!Number.isFinite(instanceId.value)) return
    loading.value = true
    try {
      row.value = await instanceApi.detail(instanceId.value, tenant.tenantId)
    } catch {
      row.value = null
    } finally {
      loading.value = false
    }
  }

  function goSteps() {
    router.push(`/monitor/job-instances/${instanceId.value}/partitions`)
  }

  function goLogs() {
    const t = row.value?.traceId
    router.push({ path: '/logs', query: t ? { traceId: t } : {} })
  }

  async function confirmRerun() {
    const r = row.value
    if (!r) return
    try {
      await ElMessageBox.confirm(
        `将对实例 ${r.instanceNo} 发起重跑（rerun），需 jobCode 与 bizDate。是否继续？`,
        '重跑确认',
        { type: 'warning' },
      )
    } catch {
      return
    }
    rerunLoading.value = true
    try {
      await instanceApi.retry(r.instanceNo, tenant.tenantId, r.jobCode, r.bizDate)
      ElMessage.success(`已发起重跑 ${r.instanceNo}`)
      await load()
    } finally {
      rerunLoading.value = false
    }
  }

  async function confirmCancel() {
    const r = row.value
    if (!r) return
    try {
      await ElMessageBox.confirm(`取消实例 ${r.instanceNo}？`, '取消确认', { type: 'warning' })
    } catch {
      return
    }
    cancelLoading.value = true
    try {
      await instanceApi.cancel(r.id, tenant.tenantId)
      ElMessage.success(`已取消实例 ${r.instanceNo}`)
      await load()
    } finally {
      cancelLoading.value = false
    }
  }

  async function confirmTerminate() {
    const r = row.value
    if (!r) return
    try {
      await ElMessageBox.confirm(`强制终止实例 ${r.instanceNo}？此操作不可逆。`, '终止确认', {
        type: 'error',
      })
    } catch {
      return
    }
    terminateLoading.value = true
    try {
      await instanceApi.terminate(r.id, tenant.tenantId)
      ElMessage.success(`已强制终止实例 ${r.instanceNo}`)
      await load()
    } finally {
      terminateLoading.value = false
    }
  }

  let sse: EventSource | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let reopenTimer: ReturnType<typeof setTimeout> | null = null
  let streamGen = 0
  let streamRetries = 0
  const MAX_SSE_RETRIES = 5

  function clearReopenTimer() {
    if (reopenTimer) {
      clearTimeout(reopenTimer)
      reopenTimer = null
    }
  }

  function closeStream() {
    streamGen++
    clearReopenTimer()
    if (sse) {
      sse.close()
      sse = null
    }
    if (reloadTimer) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }
  }

  function scheduleReload() {
    if (reloadTimer) return
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      load()
    }, 400)
  }

  function scheduleReopen(capturedGen: number) {
    if (capturedGen !== streamGen) return
    if (streamRetries >= MAX_SSE_RETRIES) return
    clearReopenTimer()
    const delay = Math.min(30_000, 1_000 * 2 ** streamRetries)
    streamRetries += 1
    reopenTimer = setTimeout(() => {
      reopenTimer = null
      void openStream()
    }, delay)
  }

  async function openStream() {
    closeStream()
    if (!Number.isFinite(instanceId.value) || !tenant.tenantId) return
    const my = streamGen
    try {
      const es = await createLogStream(
        instanceId.value,
        () => scheduleReload(),
        () => scheduleReopen(my),
      )
      if (my !== streamGen) {
        es.close()
        return
      }
      sse = es
      streamRetries = 0
    } catch {
      scheduleReopen(my)
    }
  }

  useTenantReload(() => {
    void load()
    void openStream()
  })

  watch(instanceId, () => {
    void load()
    void openStream()
  })

  onBeforeUnmount(closeStream)
</script>

<style scoped>
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--page-block-gap);
    margin-top: var(--space-md);
  }

  .mono {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
  }
</style>
