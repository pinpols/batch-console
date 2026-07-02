<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <template #header>
        <div class="trace-search">
          <el-input
            v-model="traceIdInput"
            :placeholder="t('traceDiagnostic.placeholder')"
            clearable
            class="trace-search__input"
            @keyup.enter="search"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!traceIdInput.trim()"
            @click="search"
          >
            {{ t('traceDiagnostic.search') }}
          </el-button>
          <el-button v-if="hasResult" :icon="Refresh" @click="reset">
            {{ t('traceDiagnostic.reset') }}
          </el-button>
        </div>
        <p class="trace-search__hint">
          {{ t('traceDiagnostic.hint') }}
        </p>
      </template>

      <!-- 未查询前的引导 -->
      <EmptyState v-if="!hasSearched" :description="t('traceDiagnostic.emptyTip')" :image-size="120">
        <template #image>
          <el-icon size="120" color="var(--color-text-tertiary)"><DataLine /></el-icon>
        </template>
      </EmptyState>

      <!-- 查询中 -->
      <div v-else-if="loading" class="trace-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ t('traceDiagnostic.searching') }}</span>
      </div>

      <!-- 0 命中 -->
      <div v-else-if="hasResult === false" class="trace-no-hit">
        <el-result icon="warning" :title="t('traceDiagnostic.noHitTitle')">
          <template #sub-title>
            <p>{{ t('traceDiagnostic.noHitSubtitle', { trace: lastSearchedTrace }) }}</p>
            <p class="trace-no-hit__alt">{{ t('traceDiagnostic.noHitAlt') }}</p>
          </template>
          <template #extra>
            <el-button type="primary" @click="openExternal('grafana')">
              {{ t('traceDiagnostic.openGrafana') }}
            </el-button>
            <el-button @click="openExternal('tempo')">{{
              t('traceDiagnostic.openTempo')
            }}</el-button>
          </template>
        </el-result>
      </div>

      <!-- 命中:按域分卡片展示 -->
      <div v-else class="trace-result">
        <div class="trace-result__summary">
          {{
            t('traceDiagnostic.summary', {
              trace: lastSearchedTrace,
              hits: totalHits,
              domains: hitDomains.length,
            })
          }}
        </div>

        <el-collapse v-model="expanded" class="trace-domains" @change="onCollapseChange">
          <el-collapse-item
            v-for="d in results"
            :key="d.domain"
            :name="d.domain"
            :disabled="d.rows.length === 0"
          >
            <template #title>
              <div class="trace-domain__title">
                <span class="trace-domain__name">{{ d.label }}</span>
                <el-tag :type="d.rows.length > 0 ? 'success' : 'info'" size="small" effect="plain">
                  {{ t('traceDiagnostic.hitCount', { n: d.rows.length }) }}
                </el-tag>
                <span v-if="d.error" class="trace-domain__err">
                  <el-icon><WarningFilled /></el-icon>
                  {{ t('traceDiagnostic.domainErr') }}
                </span>
              </div>
            </template>
            <div class="trace-domain__body">
              <div v-if="d.rows.length > 0" class="trace-table-wrap">
                <el-table
                  :ref="(el) => setTableRef(d.domain, el)"
                  :data="d.rows"
                  stripe
                  size="small"
                  table-layout="fixed"
                  class="console-table trace-domain__table"
                >
                  <el-table-column
                    v-for="col in d.columns"
                    :key="col.prop"
                    :prop="col.prop"
                    :label="col.label"
                    :width="col.width"
                    show-overflow-tooltip
                  >
                    <template #default="{ row }">
                      <router-link
                        v-if="col.linkTo && hasCellValue(row[col.prop])"
                        :to="col.linkTo(row)"
                        class="cell-link"
                      >
                        {{ formatCell(row[col.prop]) }}
                      </router-link>
                      <span v-else>{{ formatCell(row[col.prop]) }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, nextTick } from 'vue'
  import type { TableInstance } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    Search,
    RefreshCw as Refresh,
    Activity as DataLine,
    LoaderCircle as Loading,
    TriangleAlert as WarningFilled,
  } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { queryTraceSnapshot } from '@/api/observabilityQueries'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()

  const traceIdInput = ref<string>('')
  const lastSearchedTrace = ref<string>('')
  const loading = ref(false)
  const hasSearched = ref(false)
  const expanded = ref<string[]>([])

  // el-table 在 el-collapse 折叠态(display:none, width=0)算的列布局是错的,展开后表头/表体错位。
  // 收集每个域表格 ref,展开时 doLayout() 重算列宽修正错位。
  const tableRefs = new Map<string, TableInstance>()
  function setTableRef(domain: string, el: unknown) {
    if (el) tableRefs.set(domain, el as TableInstance)
    else tableRefs.delete(domain)
  }
  function relayoutTables(domains: string[]) {
    nextTick(() => {
      domains.forEach((n) => tableRefs.get(n)?.doLayout?.())
      window.requestAnimationFrame(() => {
        domains.forEach((n) => tableRefs.get(n)?.doLayout?.())
      })
      window.setTimeout(() => domains.forEach((n) => tableRefs.get(n)?.doLayout?.()), 160)
    })
  }
  function onCollapseChange(names: string | string[]) {
    relayoutTables(Array.isArray(names) ? names : [names])
  }

  interface DomainColumn {
    prop: string
    label: string
    width?: number | string
    linkTo?: (row: Record<string, unknown>) => string
  }
  interface DomainResult {
    domain: string
    label: string
    rows: Record<string, unknown>[]
    columns: DomainColumn[]
    error?: boolean
  }
  const results = ref<DomainResult[]>([])

  const hasResult = computed<boolean | null>(() => {
    if (!hasSearched.value) return null
    return totalHits.value > 0
  })
  const totalHits = computed(() => results.value.reduce((s, d) => s + d.rows.length, 0))
  const hitDomains = computed(() => results.value.filter((d) => d.rows.length > 0))

  function hasCellValue(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== ''
  }

  function formatCell(value: unknown): string {
    if (!hasCellValue(value)) return '—'
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  async function search() {
    const trace = traceIdInput.value.trim()
    if (!trace) return
    lastSearchedTrace.value = trace
    loading.value = true
    hasSearched.value = true
    expanded.value = []

    const t0 = Date.now()
    const tenantId = tenant.tenantId

    const snapshot = await queryTraceSnapshot(tenantId, trace)
    const jobInstances = snapshot.jobInstances ?? []
    const files = snapshot.files ?? []
    const filePipelines = snapshot.filePipelines ?? []
    const audits = snapshot.auditLogs ?? []
    const operationAudits = snapshot.operationAudits ?? []
    const executionLogs = snapshot.executionLogs ?? []
    const workflowRuns = snapshot.workflowRuns ?? []
    const outboxes = snapshot.outboxDeliveries ?? []
    const alerts = snapshot.alerts ?? []
    const deadLetters = snapshot.deadLetters ?? []

    results.value = [
      {
        domain: 'jobInstance',
        label: t('traceDiagnostic.domainJobInstance'),
        rows: jobInstances as Record<string, unknown>[],
        columns: [
          {
            prop: 'instanceNo',
            label: t('traceDiagnostic.colInstanceNo'),
            width: 200,
            linkTo: (row) => `/monitor/job-instances/${row.id}`,
          },
          { prop: 'jobCode', label: t('traceDiagnostic.colJobCode'), width: 180 },
          { prop: 'instanceStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'bizDate', label: t('traceDiagnostic.colBizDate'), width: 110 },
          { prop: 'startedAt', label: t('traceDiagnostic.colStartedAt'), width: 170 },
        ],
      },
      {
        domain: 'file',
        label: t('traceDiagnostic.domainFile'),
        rows: files as Record<string, unknown>[],
        columns: [
          {
            prop: 'id',
            label: 'ID',
            width: 100,
            linkTo: (row) => `/files/list?fileId=${row.id}`,
          },
          { prop: 'fileName', label: t('traceDiagnostic.colFileName'), width: 240 },
          { prop: 'fileStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'filePipeline',
        label: t('traceDiagnostic.domainFilePipeline'),
        rows: filePipelines as Record<string, unknown>[],
        columns: [
          {
            prop: 'id',
            label: 'ID',
            width: 100,
            linkTo: (row) => `/files/pipeline-obs?pipelineInstanceId=${row.id}`,
          },
          { prop: 'jobCode', label: t('traceDiagnostic.colJobCode'), width: 180 },
          { prop: 'pipelineType', label: t('traceDiagnostic.colPipelineType'), width: 120 },
          { prop: 'runStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'currentStage', label: t('traceDiagnostic.colCurrentStage'), width: 140 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'audit',
        label: t('traceDiagnostic.domainAudit'),
        rows: audits as Record<string, unknown>[],
        columns: [
          { prop: 'operationType', label: t('traceDiagnostic.colOperation'), width: 160 },
          { prop: 'operatorId', label: t('traceDiagnostic.colOperator'), width: 120 },
          { prop: 'operationResult', label: t('traceDiagnostic.colResult'), width: 100 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'operationAudit',
        label: t('traceDiagnostic.domainOperationAudit'),
        rows: operationAudits as Record<string, unknown>[],
        columns: [
          { prop: 'action', label: t('traceDiagnostic.colOperation'), width: 160 },
          { prop: 'operatorId', label: t('traceDiagnostic.colOperator'), width: 120 },
          { prop: 'result', label: t('traceDiagnostic.colResult'), width: 100 },
          { prop: 'aggregateType', label: t('traceDiagnostic.colAggregateType'), width: 140 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'executionLog',
        label: t('traceDiagnostic.domainExecLog'),
        rows: executionLogs as Record<string, unknown>[],
        columns: [
          { prop: 'operationType', label: t('traceDiagnostic.colOperation'), width: 160 },
          { prop: 'operationResult', label: t('traceDiagnostic.colResult'), width: 100 },
          { prop: 'message', label: t('traceDiagnostic.colMessage') },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'workflowRun',
        label: t('traceDiagnostic.domainWorkflowRun'),
        rows: workflowRuns as Record<string, unknown>[],
        columns: [
          {
            prop: 'id',
            label: 'ID',
            width: 100,
            linkTo: (row) => `/monitor/workflow-runs/${row.id}`,
          },
          { prop: 'workflowCode', label: t('traceDiagnostic.colWorkflowCode'), width: 180 },
          { prop: 'runStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'startedAt', label: t('traceDiagnostic.colStartedAt'), width: 170 },
        ],
      },
      {
        domain: 'alert',
        label: t('traceDiagnostic.domainAlert'),
        rows: alerts as Record<string, unknown>[],
        columns: [
          { prop: 'alertType', label: t('traceDiagnostic.colAlertType'), width: 160 },
          { prop: 'severity', label: t('traceDiagnostic.colSeverity'), width: 100 },
          { prop: 'alertStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'outbox',
        label: t('traceDiagnostic.domainOutbox'),
        rows: outboxes as Record<string, unknown>[],
        columns: [
          { prop: 'eventType', label: t('traceDiagnostic.colEventType'), width: 180 },
          { prop: 'deliveryStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'targetTopic', label: t('traceDiagnostic.colTargetTopic'), width: 200 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'deadLetter',
        label: t('traceDiagnostic.domainDeadLetter'),
        rows: deadLetters as Record<string, unknown>[],
        columns: [
          { prop: 'taskType', label: t('traceDiagnostic.colTaskType'), width: 160 },
          { prop: 'failureReason', label: t('traceDiagnostic.colReason') },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
    ]

    // 自动展开所有有结果的域
    expanded.value = hitDomains.value.map((d) => d.domain)
    relayoutTables(expanded.value)
    loading.value = false

    void router.replace({ query: { ...route.query, traceId: trace } })

    // 用时埋点(成功)
    void t0
  }

  function reset() {
    traceIdInput.value = ''
    lastSearchedTrace.value = ''
    hasSearched.value = false
    results.value = []
    expanded.value = []
    void router.replace({ query: { ...route.query, traceId: undefined } })
  }

  async function openExternal(target: 'grafana' | 'tempo') {
    const trace = lastSearchedTrace.value
    const base = target === 'grafana' ? 'http://localhost:13000' : 'http://localhost:13200'
    const probe = target === 'grafana' ? `${base}/api/health` : `${base}/ready`
    // P2.6 健康检查:先 ping 2s 看观测栈是否启动,挂掉就提示而非直接跳浏览器拒绝连接页
    try {
      await fetch(probe, {
        method: 'GET',
        mode: 'no-cors',
        signal: AbortSignal.timeout(2000),
      })
    } catch {
      ElMessage.warning(
        target === 'grafana'
          ? t('traceDiagnostic.grafanaDown', { url: base })
          : t('traceDiagnostic.tempoDown', { url: base }),
      )
      return
    }
    const url =
      target === 'grafana'
        ? `${base}/explore?orgId=1&left=${encodeURIComponent(JSON.stringify({ datasource: 'Tempo', queries: [{ query: trace }] }))}`
        : `${base}/api/traces/${trace}`
    window.open(url, '_blank', 'noopener')
  }

  // URL 带 traceId 直接搜
  onMounted(() => {
    const q = (route.query.traceId as string) || ''
    if (q.trim()) {
      traceIdInput.value = q
      void search()
    }
  })
</script>

<style scoped>
  .trace-search {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .trace-search__input {
    flex: 1;
    max-width: 560px;
  }
  .trace-search__hint {
    color: var(--color-text-tertiary);
    font-size: 12px;
    margin: 6px 0 0;
  }
  .trace-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px 0;
    color: var(--color-text-secondary);
  }
  .trace-no-hit__alt {
    color: var(--color-text-tertiary);
    font-size: 12px;
    margin-top: 4px;
  }
  .trace-result__summary {
    padding: 12px 16px;
    margin-bottom: 12px;
    background: var(--color-bg-info);
    border-radius: var(--radius-content);
    color: var(--color-text-primary);
  }
  .trace-domain__title {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  .trace-domain__name {
    font-weight: 600;
  }
  .trace-domain__err {
    color: var(--color-warning);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .trace-domain__body {
    padding: 8px 0;
  }
  .trace-table-wrap {
    width: 100%;
    overflow-x: auto;
  }
  .trace-domain__table {
    width: 100%;
    min-width: 760px;
  }
</style>
