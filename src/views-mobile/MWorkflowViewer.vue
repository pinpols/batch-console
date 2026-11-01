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
          </div>
          <div class="m-card__sub">{{ detail.workflowCode }} · v{{ detail.version ?? '?' }}</div>
          <div class="m-card__meta">
            <div>
              <span class="m-card__meta-key">{{ t('mobile.workflowViewer.fldType') }}</span>
              {{ detail.workflowType || '?' }}
            </div>
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
   *   - 仅展示定义图；运行深链转到独立的冻结快照视图。
   */
  import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft } from '@lucide/vue'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import { workflowApi } from '@/api/workflow'
  import { clearTrustedSvg, setTrustedMermaidSvg } from '@/utils/trustedMermaidSvg'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useSmartBack } from '@/composables/useSmartBack'
  import { loadMermaid } from '@/utils/mermaid'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { workflowRunVisualCssVars } from '@/constants/workflowStatusTheme'
  import type { WorkflowDefinitionDetailResponse } from '@/types/console-api'

  const route = useRoute()
  const tenant = useTenantStore()
  const { t } = useI18n({ useScope: 'global' })
  // useSmartBack 返回 () => void(非 { goBack }),直接当函数赋名
  const goBack = useSmartBack('/m/ops/summary')

  const id = computed(() => Number(route.params.id))
  const detail = ref<WorkflowDefinitionDetailResponse | null>(null)
  const mermaidText = ref('')
  const graphRef = ref<HTMLDivElement | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const nodeCodeBySanitized = ref<Map<string, string>>(new Map())
  type NodeMeta = NonNullable<WorkflowDefinitionDetailResponse['nodes']>[number]
  const selectedNodeMeta = ref<NodeMeta | null>(null)

  let loadRevision = 0
  function invalidateView() {
    loadRevision++
    clearTrustedSvg(graphRef.value)
    detail.value = null
    mermaidText.value = ''
    selectedNodeMeta.value = null
    nodeCodeBySanitized.value = new Map()
    loading.value = false
    errorMessage.value = ''
  }
  async function load() {
    invalidateView()
    const revision = loadRevision
    const tenantId = tenant.tenantId
    const workflowId = id.value
    const isCurrent = () => revision === loadRevision && tenantId === tenant.tenantId && workflowId === id.value
    if (!tenantId) return
    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
      errorMessage.value = t('mobile.workflowViewer.invalidId')
      return
    }
    loading.value = true
    try {
      const [d, mer] = await Promise.all([
        workflowApi.detailById(workflowId, tenantId),
        workflowApi.mermaid(workflowId, tenantId),
      ])
      if (!isCurrent()) return
      detail.value = d
      mermaidText.value = mer.mermaid ?? ''
      buildNodeMap(d)
      const renderId = await renderMermaid(mermaidText.value, isCurrent)
      if (renderId && isCurrent()) attachNodeClicks(renderId)
    } catch (err: unknown) {
      if (isCurrent()) errorMessage.value = userErrorMessage(err)
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  function buildNodeMap(d: WorkflowDefinitionDetailResponse | null) {
    const m = new Map<string, string>()
    for (const n of d?.nodes ?? []) {
      if (n.nodeCode) m.set(sanitize(n.nodeCode), n.nodeCode)
    }
    nodeCodeBySanitized.value = m
  }

  function attachNodeClicks(renderId: string) {
    if (!graphRef.value) return
    const nodes = graphRef.value.querySelectorAll<SVGGElement>('g.node')
    const prefix = `${renderId}-flowchart-`
    nodes.forEach((n) => {
      if (!n.id.startsWith(prefix)) return
      const m = /^(.+)-\d+$/.exec(n.id.slice(prefix.length))
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

  async function renderMermaid(text: string, isCurrent: () => boolean) {
    if (!text.trim()) {
      clearTrustedSvg(graphRef.value)
      return
    }
    try {
      const mermaid = await loadMermaid()
      if (!isCurrent()) return
      const renderTimestamp = Date.now()
      const randomSuffix = Math.floor(Math.random() * 1e4)
      const renderId = `m-wf-graph-${renderTimestamp}-${randomSuffix}`
      const { svg } = await mermaid.render(renderId, text)
      await nextTick()
      if (!isCurrent()) return
      setTrustedMermaidSvg(graphRef.value, svg)
      return renderId
    } catch (err: unknown) {
      if (isCurrent()) errorMessage.value = t('mobile.workflowViewer.renderFailPrefix') + userErrorMessage(err)
    }
  }

  watch([() => tenant.tenantId, () => route.params.id], invalidateView, { flush: 'sync' })
  useTenantReload(load)
  watch(() => route.params.id, () => void load())
  onScopeDispose(() => { loadRevision++ })
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
