<template>
  <PageContainer>
    <PageHeader :title="title" :description="description" back-to="/workflow/definitions">
      <template #actions>
        <el-button :icon="DocumentCopy" :disabled="!mermaidText" @click="copyText">
          {{ t('workflowMermaidViewer.btnCopyMermaid') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- DAG 主体:工具栏 + chip Legend + 画布,所有控件收进 header 一行;
         点击节点时右侧伸出 inspector panel(Dagster 风) -->
    <SectionCard ref="dagCardRef" class="dag-card">
      <template #header>
        <div class="dag-header">
          <div class="dag-header__left">
            <span class="dag-header__title">{{ t('workflowMermaidViewer.dagHeader') }}</span>
            <!-- 节点状态计数 chip(有 runId 时显示) -->
            <span v-if="runId && totalNodes > 0" class="dag-header__counts">
              <span
                v-if="statusCounts.success > 0"
                class="status-pill status-pill--success"
                title="SUCCESS"
              >
                ✓ {{ statusCounts.success }}
              </span>
              <span
                v-if="statusCounts.running > 0"
                class="status-pill status-pill--running"
                title="RUNNING"
              >
                ▶ {{ statusCounts.running }}
              </span>
              <span
                v-if="statusCounts.failed > 0"
                class="status-pill status-pill--failed"
                title="FAILED"
              >
                ✗ {{ statusCounts.failed }}
              </span>
              <span
                v-if="statusCounts.waiting > 0"
                class="status-pill status-pill--waiting"
                title="WAITING"
              >
                ⧗ {{ statusCounts.waiting }}
              </span>
              <span
                v-if="statusCounts.cancelled > 0"
                class="status-pill status-pill--cancelled"
                title="CANCELLED"
              >
                ⊘ {{ statusCounts.cancelled }}
              </span>
              <span class="status-pill status-pill--pending" title="PENDING">
                · {{ statusCounts.pending }}
              </span>
            </span>
            <el-tag
              v-if="runId && runStatus"
              size="small"
              :type="runStatusTagType"
              effect="plain"
              class="dag-header__status"
            >
              {{ runStatus }}
            </el-tag>
          </div>
          <!-- 工具栏:Airflow 风,Fit / Reset / Zoom / Fullscreen / Auto-refresh / Refresh / Download -->
          <div class="dag-header__tools">
            <el-tooltip :content="t('workflowMermaidViewer.tipZoomIn')" placement="top">
              <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" />
            </el-tooltip>
            <el-tooltip :content="t('workflowMermaidViewer.tipZoomOut')" placement="top">
              <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" />
            </el-tooltip>
            <el-tooltip :content="t('workflowMermaidViewer.tipFit')" placement="top">
              <el-button :icon="FullScreen" circle size="small" @click="fitGraph" />
            </el-tooltip>
            <el-tooltip :content="t('workflowMermaidViewer.tipReset')" placement="top">
              <el-button :icon="RefreshLeft" circle size="small" @click="resetGraph" />
            </el-tooltip>
            <el-divider direction="vertical" />
            <el-tooltip
              v-if="runId"
              :content="
                paused
                  ? t('workflowMermaidViewer.tipResumePoll')
                  : t('workflowMermaidViewer.tipPausePoll', { n: pollCountdownSec })
              "
              placement="top"
            >
              <el-button
                :icon="paused ? VideoPlay : VideoPause"
                circle
                size="small"
                :type="paused ? 'default' : 'primary'"
                @click="togglePause"
              />
            </el-tooltip>
            <el-tooltip :content="t('common.refresh')" placement="top">
              <el-button
                :icon="Refresh"
                circle
                size="small"
                :loading="loading || refresh.loading.value"
                @click="refresh.run(reload)"
              />
            </el-tooltip>
            <el-tooltip :content="t('workflowMermaidViewer.tipDownload')" placement="top">
              <el-button
                :icon="Download"
                circle
                size="small"
                :disabled="!mermaidText"
                @click="downloadSvg"
              />
            </el-tooltip>
            <el-tooltip
              :content="
                isFullscreen
                  ? t('workflowMermaidViewer.tipExitFullscreen')
                  : t('workflowMermaidViewer.tipFullscreen')
              "
              placement="top"
            >
              <el-button
                :icon="isFullscreen ? Aim : Rank"
                circle
                size="small"
                @click="toggleFullscreen"
              />
            </el-tooltip>
          </div>
        </div>
        <!-- 紧凑 chip Legend:取代原独立 Legend SectionCard -->
        <div class="dag-legend">
          <span class="legend-chip legend-chip--running">RUNNING</span>
          <span class="legend-chip legend-chip--success">SUCCESS</span>
          <span class="legend-chip legend-chip--failed">FAILED</span>
          <span class="legend-chip legend-chip--waiting">WAITING / READY</span>
          <span class="legend-chip legend-chip--cancelled">CANCELLED / SKIPPED</span>
          <span class="legend-chip legend-chip--pending">
            {{ t('workflowMermaidViewer.legendPending') }}
          </span>
          <el-link
            v-if="runId"
            type="primary"
            :underline="false"
            class="legend-back-link"
            @click="goToRun"
          >
            {{ t('workflowMermaidViewer.backToRun', { id: runId }) }}
          </el-link>
        </div>
      </template>

      <!-- 分屏:DAG 画布 + 右侧 inspector(节点选中时伸出) -->
      <div
        class="dag-split"
        :class="{
          'dag-split--with-inspector': inspectorOpen,
          'dag-split--fullscreen': isFullscreen,
        }"
      >
        <div class="dag-split__graph">
          <DataState
            :loading="loading"
            :error="errorMessage"
            :empty="!loading && !mermaidText"
            :empty-text="t('workflowMermaidViewer.noRenderData')"
          >
            <div ref="graphRef" class="workflow-mermaid-graph" />
          </DataState>
        </div>
        <aside v-if="inspectorOpen" class="dag-split__inspector">
          <div class="inspector-header">
            <span class="inspector-title">
              {{
                selectedNodeMeta
                  ? `${selectedNodeMeta.nodeCode}${selectedNodeMeta.nodeName ? ' · ' + selectedNodeMeta.nodeName : ''}`
                  : t('workflowMermaidViewer.nodeDetailTitle')
              }}
            </span>
            <el-button text :icon="Close" size="small" @click="closeInspector" />
          </div>
          <div class="inspector-body">
            <el-descriptions v-if="selectedNodeMeta" :column="1" border size="small">
              <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeCode')">
                <code>{{ selectedNodeMeta.nodeCode }}</code>
              </el-descriptions-item>
              <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeName')">
                {{ selectedNodeMeta.nodeName || '—' }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeType')">
                <el-tag size="small" effect="plain">{{ selectedNodeMeta.nodeType || '?' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.relatedJobCode"
                :label="t('workflowMermaidViewer.fldRelatedJob')"
              >
                <el-link
                  type="primary"
                  :underline="false"
                  @click="goToJobDef(selectedNodeMeta.relatedJobCode)"
                >
                  {{ selectedNodeMeta.relatedJobCode }}
                </el-link>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.relatedPipelineCode"
                :label="t('workflowMermaidViewer.fldRelatedPipeline')"
              >
                <el-link
                  type="primary"
                  :underline="false"
                  @click="goToPipeline(selectedNodeMeta.relatedPipelineCode)"
                >
                  {{ selectedNodeMeta.relatedPipelineCode }}
                </el-link>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.workerGroup"
                :label="t('workflowMermaidViewer.fldWorkerGroup')"
              >
                {{ selectedNodeMeta.workerGroup }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.retryPolicy"
                :label="t('workflowMermaidViewer.fldRetryPolicy')"
              >
                {{ selectedNodeMeta.retryPolicy }}
                <span v-if="selectedNodeMeta.retryMaxCount != null" class="cell-mute">
                  × {{ selectedNodeMeta.retryMaxCount }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.timeoutSeconds != null"
                :label="t('workflowMermaidViewer.fldTimeout')"
              >
                {{ selectedNodeMeta.timeoutSeconds }} s
              </el-descriptions-item>
              <!-- ADR-018 跨日依赖摘要(节点存在跨日依赖才展示) -->
              <el-descriptions-item
                v-if="crossDayInfo.count > 0"
                :label="t('workflowMermaidViewer.fldCrossDayDeps')"
              >
                <div class="cross-day-info">
                  <el-tag size="small" type="warning" effect="plain">
                    {{ crossDayInfo.count }} {{ t('workflowMermaidViewer.crossDayCountSuffix') }}
                  </el-tag>
                  <span v-if="crossDayInfo.timeoutSeconds != null" class="cell-mute">
                    · {{ t('workflowMermaidViewer.crossDayTimeoutLabel') }}:
                    {{ crossDayInfo.timeoutSeconds }} s
                  </span>
                </div>
                <ul class="cross-day-list">
                  <li v-for="(line, idx) in crossDayInfo.lines" :key="idx">{{ line }}</li>
                </ul>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeDescription"
                :label="t('workflowMermaidViewer.fldDescription')"
              >
                {{ selectedNodeDescription }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedNodeMeta.nodeParams"
                :label="t('workflowMermaidViewer.fldParams')"
              >
                <pre class="node-detail-json">{{ selectedNodeMeta.nodeParams }}</pre>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </aside>
      </div>
    </SectionCard>

    <!-- mermaid 源默认折叠,大多数用户不关心;需要时点开复制即可 -->
    <SectionCard v-if="mermaidText">
      <template #header>
        <span>{{ t('workflowMermaidViewer.mermaidSrcHeader') }}</span>
        <el-button text size="small" class="mermaid-toggle" @click="showSource = !showSource">
          {{
            showSource
              ? t('workflowMermaidViewer.btnCollapse')
              : t('workflowMermaidViewer.btnExpand')
          }}
        </el-button>
      </template>
      <pre v-if="showSource" class="workflow-mermaid-source">{{ mermaidText }}</pre>
    </SectionCard>

    <!-- 节点详情已迁到 DAG card 内嵌 inspector(上方),此 drawer 保留为空壳兼容; -->
    <el-drawer
      v-if="false"
      v-model="detailDrawerVisible"
      :title="''"
      direction="rtl"
      size="420px"
      :append-to-body="true"
    >
      <el-descriptions v-if="selectedNodeMeta" :column="1" border>
        <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeCode')">
          <code>{{ selectedNodeMeta.nodeCode }}</code>
        </el-descriptions-item>
        <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeName')">
          {{ selectedNodeMeta.nodeName || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('workflowMermaidViewer.fldNodeType')">
          <el-tag size="small" effect="plain">{{ selectedNodeMeta.nodeType || '?' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.relatedJobCode"
          :label="t('workflowMermaidViewer.fldRelatedJob')"
        >
          <el-link
            type="primary"
            :underline="false"
            @click="goToJobDef(selectedNodeMeta.relatedJobCode)"
          >
            {{ selectedNodeMeta.relatedJobCode }}
          </el-link>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.relatedPipelineCode"
          :label="t('workflowMermaidViewer.fldRelatedPipeline')"
        >
          <el-link
            type="primary"
            :underline="false"
            @click="goToPipeline(selectedNodeMeta.relatedPipelineCode)"
          >
            {{ selectedNodeMeta.relatedPipelineCode }}
          </el-link>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.workerGroup"
          :label="t('workflowMermaidViewer.fldWorkerGroup')"
        >
          {{ selectedNodeMeta.workerGroup }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.retryPolicy"
          :label="t('workflowMermaidViewer.fldRetryPolicy')"
        >
          {{ selectedNodeMeta.retryPolicy }}
          <span v-if="selectedNodeMeta.retryMaxCount != null" class="cell-mute">
            × {{ selectedNodeMeta.retryMaxCount }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.timeoutSeconds != null"
          :label="t('workflowMermaidViewer.fldTimeout')"
        >
          {{ selectedNodeMeta.timeoutSeconds }} s
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeDescription"
          :label="t('workflowMermaidViewer.fldDescription')"
        >
          {{ selectedNodeDescription }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="selectedNodeMeta.nodeParams"
          :label="t('workflowMermaidViewer.fldParams')"
        >
          <pre class="node-detail-json">{{ selectedNodeMeta.nodeParams }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import {
    Aim,
    Close,
    DocumentCopy,
    Download,
    FullScreen,
    Rank,
    Refresh,
    RefreshLeft,
    VideoPause,
    VideoPlay,
    ZoomIn,
    ZoomOut,
  } from '@element-plus/icons-vue'
  import svgPanZoom from 'svg-pan-zoom'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refresh = useRefreshAction()
  import mermaid from 'mermaid'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DataState from '@/components/common/DataState.vue'
  import { workflowApi } from '@/api/workflow'
  import { injectCrossDayEdges, describeCrossDayDeps } from '@/utils/crossDayMermaid'
  import { queryWorkflowNodeRuns } from '@/api/workflowQueries'
  import { instanceApi } from '@/api/instance'
  import { useTenantStore } from '@/stores/tenant'
  import type {
    ConsoleWorkflowNodeRunResponse,
    WorkflowDefinitionDetailResponse,
  } from '@/types/console-api'

  const pollIntervalMs = 8000
  const terminalStatuses = new Set(['SUCCESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED'])

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()

  const id = computed(() => Number(route.params.id))
  /** 可选 ?runId=NNN —— 存在则叠加该 run 的节点状态着色 */
  const runId = computed(() => {
    const raw = route.query.runId
    const n = Number(Array.isArray(raw) ? raw[0] : raw)
    return Number.isFinite(n) && n > 0 ? n : null
  })

  const detail = ref<WorkflowDefinitionDetailResponse | null>(null)
  /** 后端原始 mermaid 文本(无状态) */
  const mermaidText = ref('')
  /** 含状态叠加的最终 mermaid 文本(渲染用) */
  const rendererText = ref('')
  const graphRef = ref<HTMLDivElement | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const runStatus = ref<string | null>(null)
  /** sanitized mermaid id → 原始 nodeCode 反查表,用于节点点击导航 */
  const nodeCodeBySanitizedId = ref<Map<string, string>>(new Map())
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const pollingActive = ref(false)
  /** mermaid 源码默认折叠,大多数用户不关心 */
  const showSource = ref(false)
  /** 旧 drawer 保留壳 (template v-if=false),实际节点详情走 inspector */
  const detailDrawerVisible = ref(false)
  useDrawerAutoClose(detailDrawerVisible)
  /** 内嵌 inspector 是否展开;关闭后 DAG 占满宽度 */
  const inspectorOpen = ref(false)
  type NodeMeta = NonNullable<WorkflowDefinitionDetailResponse['nodes']>[number]
  const selectedNodeMeta = ref<NodeMeta | null>(null)
  /** svg-pan-zoom 实例,reload/卸载时销毁 */
  let panZoomInstance: ReturnType<typeof svgPanZoom> | null = null
  /** 节点状态计数(给 DAG header 的状态 pill) */
  const nodeRunsCache = ref<ConsoleWorkflowNodeRunResponse[]>([])
  const totalNodes = computed(() => detail.value?.nodes?.length ?? 0)
  const statusCounts = computed(() => {
    const counts = { success: 0, running: 0, failed: 0, waiting: 0, cancelled: 0, pending: 0 }
    const latest = new Map<string, string>()
    for (const r of nodeRunsCache.value) {
      const code = r.nodeCode
      if (!code) continue
      const prior = latest.get(code)
      const prevIdMatch = prior
        ? nodeRunsCache.value.find((x) => x.nodeCode === code && x.nodeStatus === prior)
        : null
      void prevIdMatch
      // 取该 nodeCode 最新 run(id 最大)
      const prevRun = nodeRunsCache.value
        .filter((x) => x.nodeCode === code && latest.has(code))
        .reduce<ConsoleWorkflowNodeRunResponse | null>(
          (a, b) => ((a?.id ?? 0) > (b.id ?? 0) ? a : b),
          null,
        )
      if (prevRun && (prevRun.id ?? 0) > (r.id ?? 0)) continue
      latest.set(code, r.nodeStatus ?? '')
    }
    for (const status of latest.values()) {
      const klass = statusToClass(status)
      if (klass === 'success') counts.success++
      else if (klass === 'running') counts.running++
      else if (klass === 'failed') counts.failed++
      else if (klass === 'waiting') counts.waiting++
      else if (klass === 'cancelled') counts.cancelled++
    }
    counts.pending = Math.max(
      0,
      totalNodes.value -
        (counts.success + counts.running + counts.failed + counts.waiting + counts.cancelled),
    )
    return counts
  })
  /** 暂停轮询 + 倒计时 */
  const paused = ref(false)
  const pollCountdownSec = ref(0)
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  /** 全屏切换 */
  const dagCardRef = ref<{ $el?: HTMLElement } | null>(null)
  const isFullscreen = ref(false)
  // description 字段在 OpenAPI schema 上是节点 extras 的可选字段;此处单独 computed 取值,
  // 模板不能写 `(x as T).description`(Vue 编译器不接受 TS 断言)。
  const selectedNodeDescription = computed<string | undefined>(
    () => (selectedNodeMeta.value as { description?: string } | null)?.description,
  )

  /** ADR-018 跨日依赖摘要,供 inspector 展示 */
  const crossDayInfo = computed(() => {
    if (!selectedNodeMeta.value) return { count: 0, timeoutSeconds: null, lines: [] as string[] }
    return describeCrossDayDeps(selectedNodeMeta.value)
  })

  const runStatusTagType = computed<'primary' | 'success' | 'danger' | 'info'>(() => {
    const s = (runStatus.value || '').toUpperCase()
    if (s === 'RUNNING') return 'primary'
    if (s === 'SUCCESS' || s === 'COMPLETED') return 'success'
    if (s === 'FAILED' || s === 'TERMINATED') return 'danger'
    return 'info'
  })

  const title = computed(() => {
    if (!detail.value) return t('workflowMermaidViewer.defaultTitle')
    return `${detail.value.workflowName ?? detail.value.workflowCode} · v${detail.value.version ?? '?'}`
  })

  const description = computed(() => {
    if (!detail.value) return ''
    const parts: string[] = []
    if (detail.value.workflowCode) parts.push(`code=${detail.value.workflowCode}`)
    if (detail.value.workflowType) parts.push(`type=${detail.value.workflowType}`)
    if (detail.value.enabled === false) parts.push(t('workflowMermaidViewer.disabledTag'))
    return parts.join(' · ')
  })

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: { htmlLabels: true, curve: 'basis' },
    securityLevel: 'strict',
  })

  async function reload() {
    if (!Number.isFinite(id.value) || id.value <= 0) {
      errorMessage.value = t('workflowMermaidViewer.invalidRouteParam')
      return
    }
    stopPoll()
    loading.value = true
    errorMessage.value = ''
    try {
      const [d, mer, nodeRuns, run] = await Promise.all([
        workflowApi.detailById(id.value, tenant.tenantId),
        workflowApi.mermaid(id.value, tenant.tenantId),
        runId.value
          ? queryWorkflowNodeRuns(tenant.tenantId, runId.value)
          : Promise.resolve<ConsoleWorkflowNodeRunResponse[]>([]),
        runId.value
          ? instanceApi.workflowRunDetail(runId.value, tenant.tenantId).catch(() => null)
          : Promise.resolve(null),
      ])
      detail.value = d
      mermaidText.value = mer.mermaid ?? ''
      runStatus.value = run?.runStatus ?? null
      nodeRunsCache.value = nodeRuns
      buildNodeCodeMap(d)
      // 先把跨日依赖的幽灵节点 + 虚线边注入 BE mermaid,再叠加状态高亮
      const enrichedMermaid = injectCrossDayEdges(mermaidText.value, d?.nodes ?? [])
      rendererText.value = applyStateOverlay(enrichedMermaid, nodeRuns)
      await renderMermaid(rendererText.value)
      attachNodeClicks()
      maybeStartPoll()
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      mermaidText.value = ''
      rendererText.value = ''
      runStatus.value = null
      clearGraph()
    } finally {
      loading.value = false
    }
  }

  /**
   * 软刷新:不动整图骨架(detail/mermaidText 不重拉),只重新拉 nodeRuns + run.runStatus,
   * 重新生成叠加并重渲染。轮询期间不显 loading,避免页面闪。终态后停轮询。
   */
  async function tickPoll() {
    if (!runId.value) return
    try {
      const [nodeRuns, run] = await Promise.all([
        queryWorkflowNodeRuns(tenant.tenantId, runId.value),
        instanceApi.workflowRunDetail(runId.value, tenant.tenantId).catch(() => null),
      ])
      runStatus.value = run?.runStatus ?? null
      nodeRunsCache.value = nodeRuns
      // 先把跨日依赖的幽灵节点 + 虚线边注入 BE mermaid,再叠加状态高亮(tickPoll 不重拉 detail,沿用 detail.value)
      const enrichedMermaid = injectCrossDayEdges(mermaidText.value, detail.value?.nodes ?? [])
      rendererText.value = applyStateOverlay(enrichedMermaid, nodeRuns)
      await renderMermaid(rendererText.value)
      attachNodeClicks()
      if (run?.runStatus && terminalStatuses.has(run.runStatus.toUpperCase())) {
        stopPoll()
      }
    } catch {
      // 轮询失败不打扰用户,等下次 tick 或手动刷新
    }
  }

  function maybeStartPoll() {
    stopPoll()
    if (!runId.value) return
    if (paused.value) return
    const s = (runStatus.value || '').toUpperCase()
    if (terminalStatuses.has(s)) return
    // tab 不可见时不开轮询,避免锁屏/切走还在打后端;visibilitychange 监听恢复
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pollingActive.value = false
      return
    }
    pollingActive.value = true
    startCountdown()
    pollTimer = setInterval(() => {
      void tickPoll().then(() => {
        // 每次 tick 完重置倒计时,让用户看到下次刷新还有几秒
        if (pollingActive.value) startCountdown()
      })
    }, pollIntervalMs)
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    pollingActive.value = false
    stopCountdown()
  }

  /** tab 切走停轮询;切回来一是立即 tick 一次,二是重启 interval */
  function onVisibilityChange() {
    if (!runId.value) return
    if (document.visibilityState === 'hidden') {
      stopPoll()
    } else {
      // 切回来:先补一次最新状态,再重启 interval
      void tickPoll().then(() => maybeStartPoll())
    }
  }

  function buildNodeCodeMap(d: WorkflowDefinitionDetailResponse | null) {
    const map = new Map<string, string>()
    for (const n of d?.nodes ?? []) {
      if (n.nodeCode) map.set(sanitizeMermaidId(n.nodeCode), n.nodeCode)
    }
    nodeCodeBySanitizedId.value = map
  }

  /**
   * mermaid 渲染后扫 SVG 里所有 g.node,根据 id="flowchart-<sanitized>-<seq>" 反查原始
   * nodeCode 并挂点击事件:有 runId 跳运行详情;无 runId 仅展示节点元数据。
   */
  function attachNodeClicks() {
    if (!graphRef.value) return
    const nodes = graphRef.value.querySelectorAll<SVGGElement>('g.node')
    const idPattern = /^flowchart-(.+)-\d+$/
    nodes.forEach((node) => {
      const m = idPattern.exec(node.id)
      if (!m) return
      const original = nodeCodeBySanitizedId.value.get(m[1])
      if (!original) return
      node.style.cursor = 'pointer'
      node.addEventListener('click', () => onNodeClick(original))
    })
  }

  function onNodeClick(nodeCode: string) {
    // 统一走内嵌 inspector(Dagster 风),不再跳走或弹 drawer 遮挡 DAG;
    // 有 runId 时 inspector 顶部加"跳运行详情看此节点"按钮(下方 goToRunNode)
    const meta = detail.value?.nodes?.find((n) => n.nodeCode === nodeCode)
    if (!meta) {
      ElMessage.info(nodeCode)
      return
    }
    selectedNodeMeta.value = meta
    inspectorOpen.value = true
    // 给 pan-zoom 留 100ms 让 layout reflow 后再 resize(否则视口尺寸是旧的)
    setTimeout(() => panZoomInstance?.resize(), 100)
  }

  function closeInspector() {
    inspectorOpen.value = false
    selectedNodeMeta.value = null
    setTimeout(() => panZoomInstance?.resize(), 100)
  }

  /**
   * 把每个 nodeCode 的最新状态映射成 mermaid classDef 着色。同一 nodeCode 在 nodeRuns 里可能
   * 有多条(retry 产生多个 run_seq 行),取 id 最大的那条作为最终状态(后端 run_seq 跟 id 同向增长)。
   */
  function applyStateOverlay(text: string, nodeRuns: ConsoleWorkflowNodeRunResponse[]): string {
    if (!text || nodeRuns.length === 0) return text
    const latest = new Map<string, ConsoleWorkflowNodeRunResponse>()
    for (const r of nodeRuns) {
      const code = r.nodeCode
      if (!code) continue
      const prior = latest.get(code)
      if (!prior || (r.id ?? 0) > (prior.id ?? 0)) latest.set(code, r)
    }
    const classLines: string[] = []
    for (const [code, r] of latest) {
      const klass = statusToClass(r.nodeStatus)
      if (klass) classLines.push(`class ${sanitizeMermaidId(code)} ${klass}`)
    }
    return (
      text.trimEnd() +
      '\n' +
      // classDef 与后端 sanitize 同源 ASCII 化
      '  classDef running fill:#3b82f6,stroke:#1d4ed8,color:#fff\n' +
      '  classDef success fill:#10b981,stroke:#047857,color:#fff\n' +
      '  classDef failed fill:#ef4444,stroke:#b91c1c,color:#fff\n' +
      '  classDef waiting fill:#f59e0b,stroke:#b45309,color:#fff\n' +
      '  classDef cancelled fill:#6b7280,stroke:#374151,color:#fff\n' +
      classLines.map((l) => '  ' + l).join('\n') +
      '\n'
    )
  }

  function statusToClass(status?: string | null): string | null {
    if (!status) return null
    const s = status.toUpperCase()
    if (s === 'RUNNING') return 'running'
    if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'SUCCEEDED') return 'success'
    if (s === 'FAILED' || s === 'PARTIAL_FAILED') return 'failed'
    if (s === 'WAITING' || s === 'READY' || s === 'CREATED') return 'waiting'
    if (s === 'CANCELLED' || s === 'SKIPPED' || s === 'TERMINATED') return 'cancelled'
    return null
  }

  /**
   * 镜像后端 WorkflowMermaidRenderer.sanitizeId:只留 ASCII 字母数字下划线,首字符非字母前缀 'n'。
   * 必须与后端逐字符行为一致,否则 class 行匹配不上节点 id 导致着色失效。
   */
  function sanitizeMermaidId(raw: string): string {
    let out = ''
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i)
      const isAsciiAlphaNum = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)
      out += isAsciiAlphaNum || c === 95 ? raw[i] : '_'
    }
    const first = out.length === 0 ? 95 : out.charCodeAt(0)
    const firstIsAsciiLetter = (first >= 65 && first <= 90) || (first >= 97 && first <= 122)
    return firstIsAsciiLetter ? out : 'n' + out
  }

  function goToRun() {
    if (runId.value) void router.push(`/monitor/workflow-runs/${runId.value}`)
  }

  function goToJobDef(jobCode: string) {
    detailDrawerVisible.value = false
    void router.push({ path: '/jobs/definitions', query: { jobCode } })
  }
  function goToPipeline(pipelineCode: string) {
    detailDrawerVisible.value = false
    void router.push({ path: '/jobs/pipelines', query: { pipelineCode } })
  }

  async function renderMermaid(text: string) {
    if (!text.trim()) {
      clearGraph()
      return
    }
    try {
      // 唯一 renderId 防 mermaid 内部 cache 影响刷新
      const renderId = `wf-graph-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const { svg } = await mermaid.render(renderId, text)
      await nextTick()
      // SVG 来自 mermaid.render(可信),直接挂到 ref.innerHTML 而非 v-html(被 ESLint 拦)
      if (graphRef.value) graphRef.value.innerHTML = svg
      // 销毁旧 pan-zoom 实例(reload 时 svg 元素被替换,旧实例引用悬挂)
      if (panZoomInstance) {
        try {
          panZoomInstance.destroy()
        } catch {
          // ignore: 旧 svg 已被 innerHTML 覆盖,destroy 内部可能找不到引用
        }
        panZoomInstance = null
      }
      const svgEl = graphRef.value?.querySelector<SVGSVGElement>('svg')
      if (svgEl) {
        // 让 svg 跟着容器尺寸缩,svg-pan-zoom 才能正确计算视口
        svgEl.setAttribute('width', '100%')
        svgEl.setAttribute('height', '100%')
        svgEl.style.maxWidth = ''
        panZoomInstance = svgPanZoom(svgEl, {
          panEnabled: true,
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.2,
          maxZoom: 8,
          zoomScaleSensitivity: 0.4,
          dblClickZoomEnabled: false,
        })
      }
    } catch (err: unknown) {
      errorMessage.value =
        t('workflowMermaidViewer.renderFailPrefix') +
        (err instanceof Error ? err.message : String(err))
      clearGraph()
    }
  }

  // ── DAG 工具栏函数 ────────────────────────────────────────────────
  function zoomIn() {
    panZoomInstance?.zoomIn()
  }
  function zoomOut() {
    panZoomInstance?.zoomOut()
  }
  function fitGraph() {
    panZoomInstance?.resize()
    panZoomInstance?.fit()
    panZoomInstance?.center()
  }
  function resetGraph() {
    panZoomInstance?.resetZoom()
    panZoomInstance?.resetPan()
  }

  function togglePause() {
    if (paused.value) {
      paused.value = false
      maybeStartPoll()
    } else {
      paused.value = true
      stopPoll()
    }
  }

  function startCountdown() {
    stopCountdown()
    pollCountdownSec.value = Math.round(pollIntervalMs / 1000)
    countdownTimer = setInterval(() => {
      pollCountdownSec.value =
        pollCountdownSec.value <= 1 ? Math.round(pollIntervalMs / 1000) : pollCountdownSec.value - 1
    }, 1000)
  }
  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    pollCountdownSec.value = 0
  }

  function downloadSvg() {
    const svgEl = graphRef.value?.querySelector<SVGSVGElement>('svg')
    if (!svgEl) return
    // 克隆 + serialize,避免 pan-zoom 注入的 transform 干扰
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    // 重置 viewport transform,导出干净的 SVG
    const viewport = clone.querySelector('.svg-pan-zoom_viewport')
    if (viewport) viewport.removeAttribute('transform')
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
      type: 'image/svg+xml',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${detail.value?.workflowCode ?? id.value}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function toggleFullscreen() {
    const el = (dagCardRef.value as { $el?: HTMLElement } | null)?.$el
    if (!el) return
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen()
        isFullscreen.value = true
      } catch {
        ElMessage.warning(t('workflowMermaidViewer.fullscreenFail'))
      }
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
    // 退出全屏后视口尺寸变,重新 fit
    setTimeout(() => panZoomInstance?.resize(), 200)
  }

  function onFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement
    setTimeout(() => panZoomInstance?.resize(), 200)
  }

  function clearGraph() {
    if (graphRef.value) graphRef.value.innerHTML = ''
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(mermaidText.value)
      ElMessage.success(t('workflowMermaidViewer.copiedToast'))
    } catch {
      ElMessage.warning(t('workflowMermaidViewer.copyFailWarn'))
    }
  }

  onMounted(() => {
    void reload()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
      document.addEventListener('fullscreenchange', onFullscreenChange)
    }
  })
  watch([() => route.params.id, () => route.query.runId], reload)
  onBeforeUnmount(() => {
    stopPoll()
    if (panZoomInstance) {
      try {
        panZoomInstance.destroy()
      } catch {
        // ignore
      }
      panZoomInstance = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  })
</script>

<style scoped>
  .dag-card :deep(.el-card__body) {
    padding: 0;
  }
  .dag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .dag-header__left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .dag-header__title {
    font-weight: 600;
  }
  .dag-header__counts {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dag-header__status {
    margin-left: 4px;
  }
  .dag-header__tools {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dag-header__tools :deep(.el-divider--vertical) {
    margin: 0 4px;
    height: 16px;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    height: 20px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 20px;
    color: #fff;
    background: var(--el-fill-color-darker);
  }
  .status-pill--success {
    background: #10b981;
  }
  .status-pill--running {
    background: #3b82f6;
  }
  .status-pill--failed {
    background: #ef4444;
  }
  .status-pill--waiting {
    background: #f59e0b;
  }
  .status-pill--cancelled {
    background: #6b7280;
  }
  .status-pill--pending {
    background: var(--el-fill-color-darker);
    color: var(--el-text-color-secondary);
  }
  .dag-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 12px 0;
  }
  .legend-back-link {
    margin-left: auto;
  }
  .dag-split {
    display: flex;
    width: 100%;
    min-height: 420px;
  }
  .dag-split--fullscreen {
    background: var(--el-bg-color);
    min-height: 100vh;
    min-height: 100dvh;
  }
  .dag-split__graph {
    flex: 1 1 auto;
    min-width: 0;
  }
  .dag-split__inspector {
    flex: 0 0 380px;
    border-left: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    display: flex;
    flex-direction: column;
    max-height: 720px;
  }
  .dag-split--fullscreen .dag-split__inspector {
    max-height: none;
  }
  .inspector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  .inspector-title {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }
  .inspector-body {
    padding: 12px;
    overflow: auto;
    flex: 1 1 auto;
  }
  .workflow-mermaid-graph {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 420px;
    cursor: grab;
  }
  .workflow-mermaid-graph:active {
    cursor: grabbing;
  }
  .workflow-mermaid-graph :deep(svg) {
    width: 100%;
    height: 100%;
    max-width: none;
  }
  .workflow-mermaid-source {
    margin: 0;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-family: var(--el-font-family-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
    overflow-x: auto;
  }
  .run-overlay-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .legend-chip {
    display: inline-flex;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 18px;
    color: #fff;
  }
  .legend-chip--running {
    background: #3b82f6;
  }
  .legend-chip--success {
    background: #10b981;
  }
  .legend-chip--failed {
    background: #ef4444;
  }
  .legend-chip--waiting {
    background: #f59e0b;
  }
  .legend-chip--cancelled {
    background: #6b7280;
  }
  .legend-chip--pending {
    background: var(--el-fill-color-darker);
    color: var(--el-text-color-secondary);
  }
  .run-overlay-link {
    margin-left: auto;
  }
  .run-overlay-status {
    margin-left: 8px;
  }
  .run-overlay-poll {
    margin-left: 12px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .run-overlay-poll-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    animation: workflow-mermaid-pulse 1.4s ease-in-out infinite;
  }
  @keyframes workflow-mermaid-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
  .mermaid-toggle {
    margin-left: 8px;
  }
  .cell-mute {
    margin-left: 4px;
    color: var(--el-text-color-secondary);
  }
  .node-detail-json {
    margin: 0;
    padding: 8px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-family: var(--el-font-family-mono, monospace);
    font-size: 12px;
    max-height: 240px;
    overflow: auto;
  }
</style>
