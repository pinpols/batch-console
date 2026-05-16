<template>
  <PageContainer>
    <PageHeader :title="title" :description="description" back-to="/workflow/definitions">
      <template #actions>
        <el-button :loading="loading" :icon="Refresh" @click="reload">
          {{ t('common.refresh') }}
        </el-button>
        <el-button :icon="DocumentCopy" :disabled="!mermaidText" @click="copyText">
          {{ t('workflowMermaidViewer.btnCopyMermaid') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- Legend 常驻:无 runId 也展示色板,避免用户首次看 DAG 不知道颜色含义。
         有 runId 时额外叠"运行状态 + 自动刷新 + 回详情链接"。 -->
    <SectionCard>
      <template #header>
        <span>{{ t('workflowMermaidViewer.legendHeader') }}</span>
        <el-tag
          v-if="runId && runStatus"
          size="small"
          :type="runStatusTagType"
          effect="plain"
          class="run-overlay-status"
        >
          {{ runStatus }}
        </el-tag>
        <span v-if="pollingActive" class="run-overlay-poll">
          <span class="run-overlay-poll-dot" />
          {{ t('workflowMermaidViewer.pollEvery', { n: pollIntervalMs / 1000 }) }}
        </span>
      </template>
      <div class="run-overlay-legend">
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
          class="run-overlay-link"
          @click="goToRun"
        >
          {{ t('workflowMermaidViewer.backToRun', { id: runId }) }}
        </el-link>
      </div>
    </SectionCard>

    <SectionCard>
      <template #header>{{ t('workflowMermaidViewer.dagHeader') }}</template>
      <DataState
        :loading="loading"
        :error="errorMessage"
        :empty="!loading && !mermaidText"
        :empty-text="t('workflowMermaidViewer.noRenderData')"
      >
        <!-- mermaid 渲染目标。SVG 由 mermaid.render() 受信任输出,挂到 ref.innerHTML 而非
             v-html(后者会被 ESLint vue/no-v-html 拦)。 -->
        <div ref="graphRef" class="workflow-mermaid-graph" />
      </DataState>
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

    <!-- 无 runId 时点节点弹出的元数据 drawer:取代原 ElMessage.info 拼字符串,
         真正能看到 nodeName / relatedJobCode / pipelineCode / 参数 / 重试策略等。 -->
    <el-drawer
      v-model="detailDrawerVisible"
      :title="
        selectedNodeMeta
          ? `${selectedNodeMeta.nodeCode}${selectedNodeMeta.nodeName ? ' · ' + selectedNodeMeta.nodeName : ''}`
          : t('workflowMermaidViewer.nodeDetailTitle')
      "
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
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { DocumentCopy, Refresh } from '@element-plus/icons-vue'
  import mermaid from 'mermaid'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DataState from '@/components/common/DataState.vue'
  import { workflowApi } from '@/api/workflow'
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
  /** 无 runId 模式下点击节点弹出的详情抽屉 */
  const detailDrawerVisible = ref(false)
  type NodeMeta = NonNullable<WorkflowDefinitionDetailResponse['nodes']>[number]
  const selectedNodeMeta = ref<NodeMeta | null>(null)
  // description 字段在 OpenAPI schema 上是节点 extras 的可选字段;此处单独 computed 取值,
  // 模板不能写 `(x as T).description`(Vue 编译器不接受 TS 断言)。
  const selectedNodeDescription = computed<string | undefined>(
    () => (selectedNodeMeta.value as { description?: string } | null)?.description,
  )

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
      buildNodeCodeMap(d)
      rendererText.value = applyStateOverlay(mermaidText.value, nodeRuns)
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
      rendererText.value = applyStateOverlay(mermaidText.value, nodeRuns)
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
    const s = (runStatus.value || '').toUpperCase()
    if (terminalStatuses.has(s)) return
    // tab 不可见时不开轮询,避免锁屏/切走还在打后端;visibilitychange 监听恢复
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pollingActive.value = false
      return
    }
    pollingActive.value = true
    pollTimer = setInterval(() => {
      void tickPoll()
    }, pollIntervalMs)
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    pollingActive.value = false
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
    if (runId.value) {
      void router.push({
        path: `/monitor/workflow-runs/${runId.value}`,
        query: { nodeCode },
      })
    } else {
      // 无 runId 时打开侧抽屉展示完整节点元数据(原本仅 ElMessage.info 拼两个字段,
      // 用户看不到关联 job/pipeline、参数、重试策略等关键字段)
      const meta = detail.value?.nodes?.find((n) => n.nodeCode === nodeCode)
      if (!meta) {
        ElMessage.info(nodeCode)
        return
      }
      selectedNodeMeta.value = meta
      detailDrawerVisible.value = true
    }
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
    } catch (err: unknown) {
      errorMessage.value =
        t('workflowMermaidViewer.renderFailPrefix') +
        (err instanceof Error ? err.message : String(err))
      clearGraph()
    }
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
    }
  })
  watch([() => route.params.id, () => route.query.runId], reload)
  onBeforeUnmount(() => {
    stopPoll()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })
</script>

<style scoped>
  .workflow-mermaid-graph {
    display: flex;
    justify-content: center;
    padding: 24px 12px;
    min-height: 200px;
    overflow-x: auto;
  }
  .workflow-mermaid-graph :deep(svg) {
    max-width: 100%;
    height: auto;
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
