<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page" :style="workflowRunVisualCssVars">
      <div class="m-page__header">
        <button class="m-page__back" @click="goBack()">
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ t('common.backToPrev') }}</span>
        </button>
      </div>

      <div v-if="loading && !mermaidText" class="m-loading">{{ t('mobile.common.loading') }}</div>
      <div v-else-if="errorMessage" class="m-empty">{{ errorMessage }}</div>

      <template v-else>
        <!-- 概要卡 -->
        <div v-if="detail" class="m-card">
          <div class="m-card__row">
            <div class="m-card__title">
              {{ detail.workflowName ?? detail.workflowCode }}
            </div>
            <span v-if="runStatus" :class="['m-chip', runChipClass]">{{ runStatus }}</span>
          </div>
          <div class="m-card__sub">{{ detail.workflowCode }} · v{{ detail.version ?? '?' }}</div>
          <div class="m-card__meta">
            <div>
              <span class="m-card__meta-key">{{ t('mobile.workflowViewer.fldType') }}</span>
              {{ detail.workflowType || '?' }}
            </div>
            <div v-if="runId">
              <span class="m-card__meta-key">{{ t('mobile.workflowViewer.fldRunId') }}</span>
              <a class="m-link" @click="goToRun">#{{ runId }}</a>
            </div>
          </div>
          <span v-if="pollingActive" class="m-poll-tag">
            <span class="m-poll-dot" />
            {{ t('mobile.workflowViewer.pollHint', { n: pollIntervalMs / 1000 }) }}
          </span>
        </div>

        <!-- Legend(常驻):移动屏小,只展示色块,文案放小字 -->
        <div class="m-card">
          <div class="m-card__title" style="margin-bottom: 6px">
            {{ t('mobile.workflowViewer.legend') }}
          </div>
          <div class="m-legend">
            <span class="m-legend-chip m-legend-chip--running">{{
              t('mobile.workflowViewer.statusRunning')
            }}</span>
            <span class="m-legend-chip m-legend-chip--success">{{
              t('mobile.workflowViewer.statusSuccess')
            }}</span>
            <span class="m-legend-chip m-legend-chip--failed">{{
              t('mobile.workflowViewer.statusFailed')
            }}</span>
            <span class="m-legend-chip m-legend-chip--waiting">{{
              t('mobile.workflowViewer.statusWaiting')
            }}</span>
            <span class="m-legend-chip m-legend-chip--cancelled">{{
              t('mobile.workflowViewer.statusCancelled')
            }}</span>
          </div>
        </div>

        <!-- DAG(可横向 / 双指缩放) -->
        <div class="m-card m-card--graph">
          <div class="m-card__title" style="margin-bottom: 6px">
            {{ t('mobile.workflowViewer.dag') }}
          </div>
          <div v-if="!mermaidText" class="m-empty m-empty--inline">
            {{ t('mobile.workflowViewer.noData') }}
          </div>
          <!-- 移动端用 .m-graph 包裹,水平滚动,捏合缩放交给浏览器(touch-action) -->
          <div v-else ref="graphRef" class="m-graph" />
        </div>

        <!-- 节点点击 → 弹底部 sheet(移动友好,比 drawer 小一截) -->
        <div v-if="selectedNodeMeta" class="m-sheet-mask" @click="selectedNodeMeta = null">
          <div class="m-sheet" @click.stop>
            <div class="m-sheet__handle" />
            <div class="m-sheet__title">
              <code>{{ selectedNodeMeta.nodeCode }}</code>
              <span v-if="selectedNodeMeta.nodeName">· {{ selectedNodeMeta.nodeName }}</span>
            </div>
            <div class="m-sheet__row">
              <span class="m-sheet__key">{{ t('mobile.workflowViewer.fldNodeType') }}</span>
              <span>{{ selectedNodeMeta.nodeType || '?' }}</span>
            </div>
            <div v-if="selectedNodeMeta.relatedJobCode" class="m-sheet__row">
              <span class="m-sheet__key">{{ t('mobile.workflowViewer.fldRelatedJob') }}</span>
              <code>{{ selectedNodeMeta.relatedJobCode }}</code>
            </div>
            <div v-if="selectedNodeMeta.relatedPipelineCode" class="m-sheet__row">
              <span class="m-sheet__key">{{ t('mobile.workflowViewer.fldRelatedPipeline') }}</span>
              <code>{{ selectedNodeMeta.relatedPipelineCode }}</code>
            </div>
            <div v-if="selectedNodeMeta.workerGroup" class="m-sheet__row">
              <span class="m-sheet__key">{{ t('mobile.workflowViewer.fldWorkerGroup') }}</span>
              <span>{{ selectedNodeMeta.workerGroup }}</span>
            </div>
            <button class="m-sheet__close" @click="selectedNodeMeta = null">
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  /**
   * 移动端只读 workflow 视图。
   * 桌面 `WorkflowMermaidViewer.vue` 的简化版:
   *   - 只看不操作(无编辑、无复制 mermaid 文本)
   *   - mermaid SVG 横向滚动 + 浏览器双指缩放(touch-action)
   *   - 节点点击弹底部 sheet 而非右侧 drawer(移动友好)
   *   - 移动 oncall 场景:从 push 推送链 / 告警详情进入,看运行 DAG 状态
   */
  import { computed, nextTick, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft, RefreshCw as Refresh } from 'lucide-vue-next'
  import mermaid from 'mermaid'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import { workflowApi } from '@/api/workflow'
  import { queryWorkflowNodeRuns } from '@/api/workflowQueries'
  import { instanceApi } from '@/api/instance'
  import { clearTrustedSvg, setTrustedMermaidSvg } from '@/utils/trustedMermaidSvg'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useSmartBack } from '@/composables/useSmartBack'
  import {
    workflowRunMermaidClassDefs,
    workflowRunStatusClass,
    workflowRunVisualCssVars,
  } from '@/constants/workflowStatusTheme'
  import type {
    ConsoleWorkflowNodeRunResponse,
    WorkflowDefinitionDetailResponse,
  } from '@/types/console-api'

  const pollIntervalMs = 10000
  const TERMINAL = new Set(['SUCCESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED'])

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const { t } = useI18n({ useScope: 'global' })
  // useSmartBack 返回 () => void(非 { goBack }),直接当函数赋名
  const goBack = useSmartBack('/m/ops/summary')

  const id = computed(() => Number(route.params.id))
  const runId = computed(() => {
    const raw = route.query.runId
    const n = Number(Array.isArray(raw) ? raw[0] : raw)
    return Number.isFinite(n) && n > 0 ? n : null
  })

  const detail = ref<WorkflowDefinitionDetailResponse | null>(null)
  const mermaidText = ref('')
  const graphRef = ref<HTMLDivElement | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const runStatus = ref<string | null>(null)
  const nodeCodeBySanitized = ref<Map<string, string>>(new Map())
  type NodeMeta = NonNullable<WorkflowDefinitionDetailResponse['nodes']>[number]
  const selectedNodeMeta = ref<NodeMeta | null>(null)

  const runChipClass = computed(() => {
    const s = (runStatus.value || '').toUpperCase()
    if (s === 'RUNNING') return 'm-chip--running'
    if (s === 'SUCCESS' || s === 'COMPLETED') return 'm-chip--success'
    if (s === 'FAILED' || s === 'TERMINATED') return 'm-chip--failed'
    return 'm-chip--default'
  })

  const pollingActive = computed(() => {
    if (!runId.value) return false
    const s = (runStatus.value || '').toUpperCase()
    return !TERMINAL.has(s)
  })

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: { htmlLabels: true, curve: 'basis' },
    securityLevel: 'strict',
  })

  async function load() {
    if (!Number.isFinite(id.value) || id.value <= 0) {
      errorMessage.value = t('mobile.workflowViewer.invalidId')
      return
    }
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
      buildNodeMap(d)
      await renderMermaid(applyStateOverlay(mermaidText.value, nodeRuns))
      attachNodeClicks()
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  function buildNodeMap(d: WorkflowDefinitionDetailResponse | null) {
    const m = new Map<string, string>()
    for (const n of d?.nodes ?? []) {
      if (n.nodeCode) m.set(sanitize(n.nodeCode), n.nodeCode)
    }
    nodeCodeBySanitized.value = m
  }

  function attachNodeClicks() {
    if (!graphRef.value) return
    const nodes = graphRef.value.querySelectorAll<SVGGElement>('g.node')
    const re = /^flowchart-(.+)-\d+$/
    nodes.forEach((n) => {
      const m = re.exec(n.id)
      if (!m) return
      const original = nodeCodeBySanitized.value.get(m[1])
      if (!original) return
      n.style.cursor = 'pointer'
      n.addEventListener('click', () => onNodeClick(original))
    })
  }

  function onNodeClick(nodeCode: string) {
    const meta = detail.value?.nodes?.find((x) => x.nodeCode === nodeCode)
    if (!meta) return
    selectedNodeMeta.value = meta
  }

  function applyStateOverlay(text: string, runs: ConsoleWorkflowNodeRunResponse[]) {
    if (!text || runs.length === 0) return text
    const latest = new Map<string, ConsoleWorkflowNodeRunResponse>()
    for (const r of runs) {
      if (!r.nodeCode) continue
      const prior = latest.get(r.nodeCode)
      if (!prior || (r.id ?? 0) > (prior.id ?? 0)) latest.set(r.nodeCode, r)
    }
    const classLines: string[] = []
    for (const [code, r] of latest) {
      const klass = workflowRunStatusClass(r.nodeStatus)
      if (klass) classLines.push(`class ${sanitize(code)} ${klass}`)
    }
    return (
      text.trimEnd() +
      '\n' +
      workflowRunMermaidClassDefs() +
      '\n' +
      classLines.map((l) => '  ' + l).join('\n') +
      '\n'
    )
  }

  function sanitize(raw: string) {
    let out = ''
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i)
      const alnum =
        (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95
      out += alnum ? raw[i] : '_'
    }
    const first = out.length ? out.charCodeAt(0) : 95
    const isLetter = (first >= 65 && first <= 90) || (first >= 97 && first <= 122)
    return isLetter ? out : 'n' + out
  }

  async function renderMermaid(text: string) {
    if (!text.trim()) {
      clearTrustedSvg(graphRef.value)
      return
    }
    try {
      const renderId = `m-wf-graph-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const { svg } = await mermaid.render(renderId, text)
      await nextTick()
      setTrustedMermaidSvg(graphRef.value, svg)
    } catch (err: unknown) {
      errorMessage.value =
        t('mobile.workflowViewer.renderFailPrefix') +
        (err instanceof Error ? err.message : String(err))
    }
  }

  function goToRun() {
    if (runId.value) void router.push(`/m/jobs/${runId.value}`)
  }

  useTenantReload(load)
  watch(() => route.params.id, load)
  watch(() => route.query.runId, load)
  // 非终态 run 短轮询;无 runId 时 isRunning 恒 false → 不轮询
  useAutoRefresh(() => {
    if (pollingActive.value) void load()
  }, pollIntervalMs)
</script>

<style scoped>
  .m-card--graph {
    /* graph 区可能很宽 */
    padding-right: 0;
  }
  .m-graph {
    /* 移动:水平滚 + 浏览器双指缩放 */
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y pinch-zoom;
    padding: 4px 0 4px 4px;
  }
  .m-graph :deep(svg) {
    max-width: none;
    height: auto;
  }
  .m-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
  }
  .m-legend-chip {
    display: inline-flex;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    line-height: 16px;
    color: #fff;
    letter-spacing: 0.02em;
  }
  .m-legend-chip--running {
    background: var(--workflow-run-running-fill);
  }
  .m-legend-chip--success {
    background: var(--workflow-run-success-fill);
  }
  .m-legend-chip--failed {
    background: var(--workflow-run-failed-fill);
  }
  .m-legend-chip--waiting {
    background: var(--workflow-run-waiting-fill);
  }
  .m-legend-chip--cancelled {
    background: var(--workflow-run-cancelled-fill);
  }
  .m-link {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .m-poll-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    color: var(--color-text-secondary);
    font-size: 11px;
  }
  .m-poll-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--workflow-run-running-fill);
    animation: m-pulse 1.4s ease-in-out infinite;
  }
  @keyframes m-pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }
  /* 底部 sheet — 比 drawer 移动屏更友好 */
  .m-sheet-mask {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 35%);
    z-index: var(--z-overlay-decoration);
    display: flex;
    align-items: flex-end;
    animation: m-sheet-mask-in 0.18s ease;
  }
  @keyframes m-sheet-mask-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .m-sheet {
    width: 100%;
    background: var(--color-bg-card);
    border-radius: 16px 16px 0 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0));
    box-shadow: 0 -6px 24px rgb(0 0 0 / 20%);
    animation: m-sheet-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    max-height: 70vh;
    overflow-y: auto;
  }
  @keyframes m-sheet-in {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  .m-sheet__handle {
    width: 40px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
    margin: 0 auto 12px;
  }
  .m-sheet__title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    word-break: break-all;
  }
  .m-sheet__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border-light);
    font-size: 13px;
  }
  .m-sheet__row:last-of-type {
    border-bottom: none;
  }
  .m-sheet__key {
    color: var(--color-text-secondary);
  }
  .m-sheet__close {
    margin-top: 12px;
    width: 100%;
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-primary);
    font-size: 14px;
  }
  .m-sheet__close:active {
    transform: scale(0.98);
  }
  .m-empty--inline {
    padding: 24px 0;
    text-align: center;
  }
</style>
