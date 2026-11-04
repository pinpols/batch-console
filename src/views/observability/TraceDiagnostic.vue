<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <template #header>
        <div class="trace-search-header">
          <div class="trace-search">
            <el-input
              v-model="traceIdInput"
              :placeholder="t('traceDiagnostic.placeholder')"
              :maxlength="128"
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
        </div>
      </template>

      <!-- 未查询前的引导 -->
      <EmptyState
        v-if="!hasSearched"
        :description="t('traceDiagnostic.emptyTip')"
        :image-size="120"
      >
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
            <p v-if="!timeline.available">{{ t('traceDiagnostic.timelineUnavailable') }}</p>
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

        <el-alert
          v-if="truncatedDomainLabels"
          class="trace-result__warning"
          type="warning"
          :closable="false"
          show-icon
          :title="t('traceDiagnostic.truncatedWarning', { domains: truncatedDomainLabels })"
        />

        <section class="trace-timeline" :aria-label="t('traceDiagnostic.timelineTitle')">
          <h2>{{ t('traceDiagnostic.timelineTitle') }}</h2>
          <p>{{ t('traceDiagnostic.timelineHint') }}</p>
          <p v-if="!timeline.available">{{ t('traceDiagnostic.timelineUnavailable') }}</p>
          <p v-else-if="!timeline.events.length">{{ t('traceDiagnostic.timelineEmpty') }}</p>
          <el-timeline v-else class="trace-timeline__list">
            <el-timeline-item
              v-for="(event, index) in visibleTimeline"
              :key="index"
              :timestamp="
                event.occurredAt
                  ? fmtDatetime(event.occurredAt)
                  : t('traceDiagnostic.timelineFieldUnavailable')
              "
              placement="top"
            >
              <span>{{ t('traceDiagnostic.timelineSource') }}: </span>
              <el-button
                v-if="timelineDomain(event.source)"
                link
                type="primary"
                @click="openTimelineDomain(timelineDomain(event.source)!)"
              >
                {{ timelineSourceLabel(event.source) }}
              </el-button>
              <strong v-else>{{
                event.source || t('traceDiagnostic.timelineFieldUnavailable')
              }}</strong>
              <span class="trace-timeline__field"
                >{{ t('traceDiagnostic.timelineEventType') }}:
                {{ event.eventType || t('traceDiagnostic.timelineFieldUnavailable') }}</span
              >
              <span class="trace-timeline__field"
                >{{ t('traceDiagnostic.timelineReference') }}:
                {{ event.referenceId || t('traceDiagnostic.timelineFieldUnavailable') }}</span
              >
              <span class="trace-timeline__field"
                >{{ t('traceDiagnostic.colStatus') }}:
                {{ event.status || t('traceDiagnostic.timelineFieldUnavailable') }}</span
              >
              <span class="trace-timeline__field"
                >{{ t('traceDiagnostic.colMessage') }}:
                {{ event.message || t('traceDiagnostic.timelineFieldUnavailable') }}</span
              >
            </el-timeline-item>
          </el-timeline>
          <el-button
            v-if="!showAllTimeline && timeline.events.length > visibleTimeline.length"
            link
            type="primary"
            @click="showAllTimeline = true"
          >
            {{
              t('traceDiagnostic.timelineLimited', {
                count: timeline.events.length - visibleTimeline.length,
              })
            }}
          </el-button>
        </section>

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
                  :ref="(el: unknown) => setTableRef(d.domain, el)"
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
                    :show-overflow-tooltip="!col.inspect"
                  >
                    <template #default="{ row }">
                      <CopyableText
                        v-if="col.inspect && hasCellValue(row[col.prop])"
                        :text="formatCell(row[col.prop], col.prop)"
                        :copyable="false"
                      >
                        <router-link v-if="col.linkTo" :to="col.linkTo(row)" class="cell-link">
                          {{ formatCell(row[col.prop], col.prop) }}
                        </router-link>
                        <span v-else>{{ formatCell(row[col.prop], col.prop) }}</span>
                      </CopyableText>
                      <router-link
                        v-else-if="col.linkTo && hasCellValue(row[col.prop])"
                        :to="col.linkTo(row)"
                        class="cell-link"
                      >
                        {{ formatCell(row[col.prop], col.prop) }}
                      </router-link>
                      <span v-else>{{ formatCell(row[col.prop], col.prop) }}</span>
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
  import { ref, computed, onMounted, nextTick, watch } from 'vue'
  import type { TableInstance } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    Search,
    RefreshCw as Refresh,
    Activity as DataLine,
    LoaderCircle as Loading,
    TriangleAlert as WarningFilled,
  } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { queryTraceSnapshot } from '@/api/observabilityQueries'
  import { buildTraceTimeline } from './traceTimeline'
  import { fmtDatetime } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const requestScope = useTenantRequestScope()

  const traceIdInput = ref<string>('')
  const lastSearchedTrace = ref<string>('')
  const loading = ref(false)
  const hasSearched = ref(false)
  const expanded = ref<string[]>([])
  const truncatedDomains = ref<string[]>([])
  const timelineRecords = ref<unknown>(undefined)
  const showAllTimeline = ref(false)

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
  function onCollapseChange(names: string | number | Array<string | number>) {
    const domainNames = Array.isArray(names) ? names : [names]
    const normalizedDomainNames = domainNames.map(String)
    relayoutTables(normalizedDomainNames)
  }

  interface DomainColumn {
    prop: string
    label: string
    width?: number | string
    inspect?: boolean
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
    return totalHits.value > 0 || timeline.value.events.length > 0
  })
  const totalHits = computed(() => results.value.reduce((s, d) => s + d.rows.length, 0))
  const hitDomains = computed(() => results.value.filter((d) => d.rows.length > 0))
  const timeline = computed(() => buildTraceTimeline(timelineRecords.value))
  const visibleTimeline = computed(() =>
    showAllTimeline.value ? timeline.value.events : timeline.value.events.slice(0, 30),
  )

  // 按后端事件的 source 跳转对应的明细分组，不将同 Trace 的事件解释成因果关系。
  const timelineSourceDomains: Record<string, string> = {
    JOB_INSTANCE: 'jobInstance',
    WORKFLOW_RUN: 'workflowRun',
    WORKFLOW_NODE_RUN: 'workflowNodeRun',
    FILE_RECORD: 'file',
    FILE_PIPELINE: 'filePipeline',
    FILE_AUDIT: 'audit',
    OPERATION_AUDIT: 'operationAudit',
    EXECUTION_LOG: 'executionLog',
    OUTBOX_DELIVERY: 'outbox',
    ALERT: 'alert',
    DEAD_LETTER: 'deadLetter',
  }
  function timelineDomain(source: string | null): string | undefined {
    const domain = source ? timelineSourceDomains[source] : undefined
    return results.value.some((item) => item.domain === domain && item.rows.length > 0)
      ? domain
      : undefined
  }
  function timelineSourceLabel(source: string | null): string {
    const domain = timelineDomain(source)
    return results.value.find((item) => item.domain === domain)?.label ?? source ?? '—'
  }
  function openTimelineDomain(domain: string) {
    if (!expanded.value.includes(domain)) expanded.value = [...expanded.value, domain]
    relayoutTables([domain])
    nextTick(() => tableRefs.get(domain)?.$el?.scrollIntoView?.({ block: 'nearest' }))
  }

  const truncatedDomainI18nKeys: Record<string, string> = {
    jobInstances: 'traceDiagnostic.domainJobInstance',
    workflowRuns: 'traceDiagnostic.domainWorkflowRun',
    workflowNodeRuns: 'traceDiagnostic.domainWorkflowNodeRun',
    files: 'traceDiagnostic.domainFile',
    filePipelines: 'traceDiagnostic.domainFilePipeline',
    auditLogs: 'traceDiagnostic.domainAudit',
    operationAudits: 'traceDiagnostic.domainOperationAudit',
    executionLogs: 'traceDiagnostic.domainExecLog',
    outboxDeliveries: 'traceDiagnostic.domainOutbox',
    alerts: 'traceDiagnostic.domainAlert',
    deadLetters: 'traceDiagnostic.domainDeadLetter',
  }
  const truncatedDomainLabels = computed(() =>
    truncatedDomains.value
      .map((domain) => {
        const key = truncatedDomainI18nKeys[domain]
        return key ? t(key) : domain
      })
      .join(', '),
  )

  function hasCellValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    const valueText = String(value)
    const trimmedValue = valueText.trim()
    return trimmedValue !== ''
  }

  /** 时间字段（*At）按系统时区格式化，与其他页面一致；其余值原样展示 */
  function formatCell(value: unknown, prop?: string): string {
    if (!hasCellValue(value)) return '—'
    if (prop && /At$/.test(prop) && typeof value === 'string') return fmtDatetime(value)
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  async function search() {
    const trace = traceIdInput.value.trim()
    if (!trace) return
    const scope = requestScope.begin()
    if (!scope.tenantId) return
    lastSearchedTrace.value = trace
    loading.value = true
    hasSearched.value = true
    expanded.value = []
    truncatedDomains.value = []
    results.value = []
    timelineRecords.value = undefined
    showAllTimeline.value = false

    const t0 = Date.now()
    let snapshot
    try {
      snapshot = await queryTraceSnapshot(scope.tenantId, trace)
    } catch (error) {
      if (!requestScope.isCurrent(scope)) return
      hasSearched.value = false
      throw error
    } finally {
      if (requestScope.isCurrent(scope)) loading.value = false
    }
    if (!requestScope.isCurrent(scope)) return
    timelineRecords.value = snapshot.timeline
    const jobInstances = snapshot.jobInstances ?? []
    const files = snapshot.files ?? []
    const filePipelines = snapshot.filePipelines ?? []
    const audits = snapshot.auditLogs ?? []
    const operationAudits = snapshot.operationAudits ?? []
    const executionLogs = snapshot.executionLogs ?? []
    const workflowRuns = snapshot.workflowRuns ?? []
    const workflowNodeRuns = snapshot.workflowNodeRuns ?? []
    const outboxes = snapshot.outboxDeliveries ?? []
    const alerts = snapshot.alerts ?? []
    const deadLetters = snapshot.deadLetters ?? []
    truncatedDomains.value = snapshot.truncatedDomains ?? []

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
            inspect: true,
            linkTo: (row) => `/monitor/job-instances/${row.id}`,
          },
          { prop: 'jobCode', label: t('traceDiagnostic.colJobCode'), width: 180, inspect: true },
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
          { prop: 'fileName', label: t('traceDiagnostic.colFileName'), width: 240, inspect: true },
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
          { prop: 'jobCode', label: t('traceDiagnostic.colJobCode'), width: 180, inspect: true },
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
          {
            prop: 'operatorId',
            label: t('traceDiagnostic.colOperator'),
            width: 120,
            inspect: true,
          },
          { prop: 'operationResult', label: t('traceDiagnostic.colResult'), width: 100 },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'operationAudit',
        label: t('traceDiagnostic.domainOperationAudit'),
        rows: operationAudits as Record<string, unknown>[],
        columns: [
          { prop: 'action', label: t('traceDiagnostic.colOperation'), width: 160, inspect: true },
          {
            prop: 'operatorId',
            label: t('traceDiagnostic.colOperator'),
            width: 120,
            inspect: true,
          },
          { prop: 'result', label: t('traceDiagnostic.colResult'), width: 100 },
          {
            prop: 'aggregateType',
            label: t('traceDiagnostic.colAggregateType'),
            width: 140,
            inspect: true,
          },
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
          { prop: 'message', label: t('traceDiagnostic.colMessage'), inspect: true },
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
          {
            prop: 'workflowCode',
            label: t('traceDiagnostic.colWorkflowCode'),
            width: 180,
            inspect: true,
          },
          { prop: 'runStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'startedAt', label: t('traceDiagnostic.colStartedAt'), width: 170 },
        ],
      },
      {
        domain: 'workflowNodeRun',
        label: t('traceDiagnostic.domainWorkflowNodeRun'),
        rows: workflowNodeRuns as Record<string, unknown>[],
        columns: [
          { prop: 'nodeCode', label: t('traceDiagnostic.colNodeCode'), width: 180, inspect: true },
          { prop: 'nodeType', label: t('traceDiagnostic.colNodeType'), width: 120 },
          { prop: 'nodeStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          { prop: 'retryCount', label: t('traceDiagnostic.colRetryCount'), width: 100 },
          { prop: 'startedAt', label: t('traceDiagnostic.colStartedAt'), width: 170 },
        ],
      },
      {
        domain: 'alert',
        label: t('traceDiagnostic.domainAlert'),
        rows: alerts as Record<string, unknown>[],
        columns: [
          {
            prop: 'alertType',
            label: t('traceDiagnostic.colAlertType'),
            width: 160,
            inspect: true,
          },
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
          {
            prop: 'eventType',
            label: t('traceDiagnostic.colEventType'),
            width: 180,
            inspect: true,
          },
          { prop: 'deliveryStatus', label: t('traceDiagnostic.colStatus'), width: 110 },
          {
            prop: 'targetTopic',
            label: t('traceDiagnostic.colTargetTopic'),
            width: 200,
            inspect: true,
          },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
      {
        domain: 'deadLetter',
        label: t('traceDiagnostic.domainDeadLetter'),
        rows: deadLetters as Record<string, unknown>[],
        columns: [
          { prop: 'taskType', label: t('traceDiagnostic.colTaskType'), width: 160 },
          { prop: 'failureReason', label: t('traceDiagnostic.colReason'), inspect: true },
          { prop: 'createdAt', label: t('traceDiagnostic.colCreatedAt'), width: 170 },
        ],
      },
    ]

    // 自动展开所有有结果的域
    expanded.value = hitDomains.value.map((d) => d.domain)
    relayoutTables(expanded.value)
    void router.replace({ query: { ...route.query, traceId: trace } })

    // 用时埋点(成功)
    void t0
  }

  function reset() {
    requestScope.begin()
    loading.value = false
    timelineRecords.value = undefined
    showAllTimeline.value = false
    traceIdInput.value = ''
    lastSearchedTrace.value = ''
    hasSearched.value = false
    results.value = []
    expanded.value = []
    truncatedDomains.value = []
    void router.replace({ query: { ...route.query, traceId: undefined } })
  }

  watch(() => tenant.tenantId, reset, { flush: 'sync' })

  function openExternal(target: 'grafana' | 'tempo') {
    const trace = lastSearchedTrace.value
    if (target === 'tempo' && !/^[0-9a-f]{32}$/i.test(trace)) {
      ElMessage.warning(t('traceDiagnostic.tempoRequiresW3cTraceId'))
      return
    }
    const configuredUrl =
      target === 'grafana' ? import.meta.env.VITE_GRAFANA_URL : import.meta.env.VITE_TEMPO_URL
    const service = t(
      target === 'grafana' ? 'degradation.sourceGrafana' : 'degradation.sourceTempo',
    )
    let base: URL
    try {
      base = new URL(configuredUrl ?? '')
    } catch {
      ElMessage.warning(t('traceDiagnostic.externalPlatformNotConfigured', { service }))
      return
    }
    const hasUnsupportedProtocol = base.protocol !== 'http:' && base.protocol !== 'https:'
    const diagnosticUrlIsUnsafe = hasUnsupportedProtocol || base.username || base.password
    if (diagnosticUrlIsUnsafe) {
      ElMessage.warning(t('traceDiagnostic.externalPlatformNotConfigured', { service }))
      return
    }
    const basePath = base.pathname.replace(/\/+$/, '')
    const url = new URL(
      target === 'grafana'
        ? `${basePath}/explore`
        : `${basePath}/api/traces/${encodeURIComponent(trace)}`,
      base.origin,
    )
    if (target === 'grafana') {
      url.searchParams.set('orgId', '1')
      url.searchParams.set(
        'left',
        JSON.stringify({ datasource: 'Tempo', queries: [{ query: trace }] }),
      )
    }
    window.open(url.toString(), '_blank', 'noopener')
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
  .trace-search-header {
    width: 100%;
    min-width: 0;
  }
  .trace-search {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .trace-search__input {
    flex: 1;
    min-width: 0;
    max-width: 560px;
  }
  .trace-search :deep(.el-button + .el-button) {
    margin-left: 0;
  }
  .trace-search__hint {
    color: var(--color-text-tertiary);
    font-size: 12px;
    margin: 6px 0 0;
  }
  @media (max-width: 600px) {
    .trace-search {
      flex-wrap: wrap;
    }
    .trace-search__input {
      flex-basis: 100%;
      max-width: none;
    }
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
  .trace-result__warning {
    margin-bottom: 12px;
  }
  .trace-timeline {
    margin: 16px 0;
    padding: 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }
  .trace-timeline h2 {
    margin: 0;
    font-size: 16px;
  }
  .trace-timeline p {
    color: var(--color-text-secondary);
    font-size: 13px;
  }
  .trace-timeline__list {
    max-height: 360px;
    overflow: auto;
    padding-left: 4px;
  }
  .trace-timeline__field {
    margin-left: 12px;
    overflow-wrap: anywhere;
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
