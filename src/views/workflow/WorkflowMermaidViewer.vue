<template>
  <PageContainer>
    <PageHeader :title="title" :description="description" back-to="/workflow/definitions">
      <template #actions>
        <el-button :loading="loading" :icon="Refresh" @click="reload">刷新</el-button>
        <el-button :icon="DocumentCopy" :disabled="!mermaidText" @click="copyText">
          复制 mermaid
        </el-button>
      </template>
    </PageHeader>

    <SectionCard v-if="runId">
      <template #header>
        运行状态叠加
        <el-tag
          v-if="runStatus"
          size="small"
          :type="runStatusTagType"
          effect="plain"
          class="run-overlay-status"
        >
          {{ runStatus }}
        </el-tag>
        <span v-if="pollingActive" class="run-overlay-poll">
          <span class="run-overlay-poll-dot" />
          每 {{ pollIntervalMs / 1000 }}s 自动刷新
        </span>
      </template>
      <div class="run-overlay-legend">
        <span class="legend-chip legend-chip--running">RUNNING</span>
        <span class="legend-chip legend-chip--success">SUCCESS</span>
        <span class="legend-chip legend-chip--failed">FAILED</span>
        <span class="legend-chip legend-chip--waiting">WAITING / READY</span>
        <span class="legend-chip legend-chip--cancelled">CANCELLED / SKIPPED</span>
        <span class="legend-chip legend-chip--pending">未启动 / 其它</span>
        <el-link type="primary" :underline="false" class="run-overlay-link" @click="goToRun">
          回到运行详情 #{{ runId }}
        </el-link>
      </div>
    </SectionCard>

    <SectionCard>
      <template #header>DAG 视图</template>
      <DataState
        :loading="loading"
        :error="errorMessage"
        :empty="!loading && !mermaidText"
        empty-text="还没有渲染数据"
      >
        <!-- mermaid 渲染目标。SVG 由 mermaid.render() 受信任输出,挂到 ref.innerHTML 而非
             v-html(后者会被 ESLint vue/no-v-html 拦)。 -->
        <div ref="graphRef" class="workflow-mermaid-graph" />
      </DataState>
    </SectionCard>

    <SectionCard v-if="mermaidText">
      <template #header>mermaid 源(可粘贴到 PR/Wiki)</template>
      <pre class="workflow-mermaid-source">{{ mermaidText }}</pre>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
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
  } from '@/types/api.generated'

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

  const runStatusTagType = computed<'primary' | 'success' | 'danger' | 'info'>(() => {
    const s = (runStatus.value || '').toUpperCase()
    if (s === 'RUNNING') return 'primary'
    if (s === 'SUCCESS' || s === 'COMPLETED') return 'success'
    if (s === 'FAILED' || s === 'TERMINATED') return 'danger'
    return 'info'
  })

  const title = computed(() => {
    if (!detail.value) return 'Workflow 视图'
    return `${detail.value.workflowName ?? detail.value.workflowCode} · v${detail.value.version ?? '?'}`
  })

  const description = computed(() => {
    if (!detail.value) return ''
    const parts: string[] = []
    if (detail.value.workflowCode) parts.push(`code=${detail.value.workflowCode}`)
    if (detail.value.workflowType) parts.push(`type=${detail.value.workflowType}`)
    if (detail.value.enabled === false) parts.push('已禁用')
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
      errorMessage.value = '路由参数 id 非法'
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
      const meta = detail.value?.nodes?.find((n) => n.nodeCode === nodeCode)
      ElMessage.info(
        `${nodeCode}${meta?.nodeName ? ' · ' + meta.nodeName : ''} · type=${meta?.nodeType ?? '?'}`,
      )
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
      errorMessage.value = '渲染失败: ' + (err instanceof Error ? err.message : String(err))
      clearGraph()
    }
  }

  function clearGraph() {
    if (graphRef.value) graphRef.value.innerHTML = ''
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(mermaidText.value)
      ElMessage.success('已复制到剪贴板')
    } catch {
      ElMessage.warning('复制失败,请手动选择上方文本')
    }
  }

  onMounted(reload)
  watch([() => route.params.id, () => route.query.runId], reload)
  onBeforeUnmount(stopPoll)
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
</style>
