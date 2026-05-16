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
      <el-empty v-if="!hasSearched" :description="t('traceDiagnostic.emptyTip')" :image-size="120">
        <template #image>
          <el-icon size="120" color="var(--color-text-tertiary)"><DataLine /></el-icon>
        </template>
      </el-empty>

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

        <el-collapse v-model="expanded" class="trace-domains">
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
              <el-table
                v-if="d.rows.length > 0"
                :data="d.rows"
                stripe
                size="small"
                class="console-table"
              >
                <el-table-column
                  v-for="col in d.columns"
                  :key="col.prop"
                  :prop="col.prop"
                  :label="col.label"
                  :width="col.width"
                  show-overflow-tooltip
                >
                  <template v-if="col.linkTo" #default="{ row }">
                    <router-link v-if="row[col.prop]" :to="col.linkTo(row)" class="cell-link">
                      {{ row[col.prop] }}
                    </router-link>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Search, Refresh, DataLine, Loading, WarningFilled } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { jobApi } from '@/api/job'
  import { fileApi } from '@/api/file'
  import {
    queryAudits,
    queryExecutionLogs,
    queryOutboxDeliveries,
    queryDeadLetters,
  } from '@/api/observabilityQueries'
  import { queryWorkflowRuns } from '@/api/workflowQueries'
  import { queryAlertsAll } from '@/api/alertsQuery'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()

  const traceIdInput = ref<string>('')
  const lastSearchedTrace = ref<string>('')
  const loading = ref(false)
  const hasSearched = ref(false)
  const expanded = ref<string[]>([])

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

  // 多域并行 fetch,每个独立 try/catch,单域失败不影响整体。
  // 部分 BE 接口不支持 traceId 过滤,统一在前端按 row.traceId 兜底过滤。
  async function fetchDomain(domain: string, fn: () => Promise<unknown[]>): Promise<unknown[]> {
    try {
      return (await fn()) || []
    } catch {
      return []
    }
  }

  /**
   * 行级 traceId 过滤。某些行类型(outbox / deadLetter 等)在 OpenAPI schema 上没有
   * `traceId` 字段声明,但后端实际下发或存在 props 里。这里用宽松约束让调用方
   * 不必逐 row 类型扩展,只在运行时按 `r.traceId` 取值。
   */
  function filterByTrace<T>(rows: T[], trace: string): T[] {
    return rows.filter((r) => (r as { traceId?: string | null } | null)?.traceId === trace)
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

    const [
      jobInstances,
      files,
      audits,
      executionLogs,
      workflowRuns,
      outboxes,
      alerts,
      deadLetters,
    ] = await Promise.all([
      fetchDomain('jobInstance', async () => {
        const r = await jobApi.listInstances({ tenantId, traceId: trace, page: 1, pageSize: 200 })
        return r.records as unknown[]
      }),
      fetchDomain('file', async () => {
        const r = await fileApi.list({ tenantId, traceId: trace, page: 1, pageSize: 200 })
        return r.records as unknown[]
      }),
      fetchDomain('audit', () => queryAudits(tenantId, { traceId: trace })),
      fetchDomain('executionLog', () => queryExecutionLogs(tenantId, { traceId: trace })),
      // 以下四域:BE 不支持 traceId 过滤,客户端按 row.traceId 兜底过滤
      fetchDomain('workflowRun', async () =>
        filterByTrace(await queryWorkflowRuns(tenantId), trace),
      ),
      fetchDomain('outbox', async () =>
        filterByTrace(await queryOutboxDeliveries(tenantId), trace),
      ),
      fetchDomain('alert', async () => filterByTrace(await queryAlertsAll(tenantId), trace)),
      fetchDomain('deadLetter', async () => filterByTrace(await queryDeadLetters(tenantId), trace)),
    ])

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
</style>
