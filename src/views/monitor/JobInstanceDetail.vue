<template>
  <PageContainer>
    <PageHeader
      :title="t('monitor.detailTitle')"
      :description="headerDesc"
      back-to="/monitor/job-instances"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">
          {{ t('monitor.detailRefresh') }}
        </el-button>
        <el-button v-if="row" type="danger" :loading="cancelLoading" @click="confirmCancel">
          {{ t('monitor.detailCancel') }}
        </el-button>
      </template>
    </PageHeader>

    <div v-if="row" class="detail-grid">
      <MetricCard
        :label="t('monitor.detailMetricInstanceNo')"
        :value="row.instanceNo"
        description="instanceNo"
      />
      <MetricCard
        :label="t('monitor.detailMetricStatus')"
        :value="row.instanceStatus"
        description="instanceStatus"
      />
      <MetricCard
        :label="t('monitor.detailMetricJobCode')"
        :value="row.jobCode"
        description="jobCode"
      />
      <MetricCard
        :label="t('monitor.detailMetricBizDate')"
        :value="row.bizDate"
        description="bizDate"
      />
      <MetricCard
        :label="t('monitor.detailMetricTrace')"
        :value="row.traceId || '—'"
        description="traceId"
      />
      <MetricCard
        :label="t('monitor.detailMetricQueue')"
        :value="row.queueCode || '—'"
        description="queueCode"
      />
    </div>

    <SectionCard v-if="row">
      <template #header>{{ t('monitor.detailTimeSection') }}</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('monitor.detailStarted')">{{
          fmtDatetime(row.startedAt)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.detailFinished')">{{
          fmtDatetime(row.finishedAt)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.detailDeadline')">{{
          fmtDatetime(row.deadlineAt)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.detailSlaAlerted')">{{
          row.slaAlertedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.detailRerun')">
          {{ row.rerunFlag ? t('common.yes') : t('common.no') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.detailRetry')">
          {{ row.retryFlag ? t('common.yes') : t('common.no') }}
        </el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button type="primary" @click="goSteps">{{ t('monitor.detailGoSteps') }}</el-button>
        <el-button @click="goLogs">{{ t('monitor.detailGoLogs') }}</el-button>
        <el-button type="warning" :loading="rerunLoading" @click="confirmRerun">
          {{ t('monitor.detailRerunBtn') }}
        </el-button>
        <el-button type="danger" :loading="cancelLoading" @click="confirmCancel">
          {{ t('monitor.detailCancelBtn') }}
        </el-button>
        <el-button type="danger" :loading="terminateLoading" @click="confirmTerminate">
          {{ t('monitor.detailTerminateBtn') }}
        </el-button>
      </div>
    </SectionCard>

    <SectionCard v-if="row">
      <template #header>{{ t('monitor.detailParamsSection') }}</template>
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
      <EmptyState :description="t('monitor.detailEmpty')" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDatetime } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
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
    if (!row.value) return t('monitor.detailLoading')
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
        t('monitor.rerunConfirmText', { no: r.instanceNo }),
        t('monitor.rerunConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    rerunLoading.value = true
    try {
      await instanceApi.retry(r.instanceNo, tenant.tenantId, r.jobCode, r.bizDate)
      ElMessage.success(t('monitor.rerunSuccess', { no: r.instanceNo }))
      await load()
    } finally {
      rerunLoading.value = false
    }
  }

  async function confirmCancel() {
    const r = row.value
    if (!r) return
    try {
      await ElMessageBox.confirm(
        t('monitor.instanceCancelText', { no: r.instanceNo }),
        t('monitor.instanceCancelTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    cancelLoading.value = true
    try {
      await instanceApi.cancel(r.id, tenant.tenantId)
      ElMessage.success(t('monitor.instanceCanceled', { no: r.instanceNo }))
      await load()
    } finally {
      cancelLoading.value = false
    }
  }

  async function confirmTerminate() {
    const r = row.value
    if (!r) return
    try {
      await confirmDanger({
        verb: t('monitor.terminateVerb'),
        target: t('monitor.terminateTarget', { no: r.instanceNo }),
        consequence: t('monitor.terminateConsequence'),
        irreversible: true,
      })
    } catch {
      return
    }
    terminateLoading.value = true
    try {
      await instanceApi.terminate(r.id, tenant.tenantId)
      ElMessage.success(t('monitor.terminateSuccess', { no: r.instanceNo }))
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
