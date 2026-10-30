<template>
  <div
    class="mini-dag"
    :class="{ 'mini-dag--interactive': interactive }"
    :style="workflowRunVisualCssVars"
  >
    <div v-if="interactive" class="mini-dag__tools">
      <el-button
        size="small"
        :aria-label="t('workflowMermaidViewer.tipZoomOut')"
        @click="changeZoom(-0.2)"
        >{{ t('workflowMermaidViewer.tipZoomOut') }}</el-button
      >
      <el-button
        size="small"
        :aria-label="t('workflowMermaidViewer.tipZoomIn')"
        @click="changeZoom(0.2)"
        >{{ t('workflowMermaidViewer.tipZoomIn') }}</el-button
      >
      <el-button size="small" @click="fitGraph">{{ t('workflowMermaidViewer.tipFit') }}</el-button>
      <el-button size="small" @click="resetZoom">{{
        t('workflowMermaidViewer.tipReset')
      }}</el-button>
    </div>
    <DataState
      :loading="loading"
      :error="renderError || errorMessage"
      :has-data="Boolean(mermaidText)"
      :empty-text="emptyText"
    >
      <div ref="graphRef" class="mini-dag__graph" :style="graphStyle" />
    </DataState>
    <div v-if="mermaidText" class="mini-dag__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import DataState from '@/components/common/DataState.vue'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { loadMermaid } from '@/utils/mermaid'
  import { clearTrustedSvg, setTrustedMermaidSvg } from '@/utils/trustedMermaidSvg'
  import {
    workflowRunMermaidClassDefs,
    workflowRunStatusClass,
    workflowRunVisualCssVars,
  } from '@/constants/workflowStatusTheme'
  import type { ConsoleWorkflowNodeRunResponse } from '@/types/console-api'

  /**
   * Mini DAG 预览组件:
   * - 给定 mermaid 文本 + 可选 nodeRuns 状态着色,渲染一个不可缩放/平移的小型 SVG 预览
   * - 用于 WorkflowDefinitionList 抽屉的 "DAG 预览" Tab 和 WorkflowRunDetail 顶部
   * - 不挂 svg-pan-zoom,纯静态预览,要交互去 WorkflowMermaidViewer
   */
  const props = defineProps<{
    mermaidText: string
    nodeRuns?: ConsoleWorkflowNodeRunResponse[]
    /** 自定义最大高度;默认 280px,RunDetail 顶部用 200 */
    interactive?: boolean
    autoFit?: boolean
    maxHeight?: number
    loading?: boolean
    errorMessage?: string
    emptyText?: string
  }>()

  const { t } = useI18n()
  const zoom = ref(1)
  let intrinsicWidth = 0
  const graphRef = ref<HTMLDivElement | null>(null)
  const graphStyle = computed(() => ({
    maxHeight: `${props.maxHeight ?? 280}px`,
  }))
  const renderError = ref<string>('')

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

  function applyStateOverlay(text: string, nodeRuns: ConsoleWorkflowNodeRunResponse[]): string {
    if (!text || nodeRuns.length === 0) return text
    const latest = new Map<string, ConsoleWorkflowNodeRunResponse>()
    for (const r of nodeRuns) {
      const code = r.nodeCode
      if (!code) continue
      const prior = latest.get(code)
      const candidateIsNewerRun = !prior || (r.id ?? 0) > (prior.id ?? 0)
      if (candidateIsNewerRun) latest.set(code, r)
    }
    const classLines: string[] = []
    for (const [code, r] of latest) {
      const klass = workflowRunStatusClass(r.nodeStatus)
      if (klass) classLines.push(`class ${sanitizeMermaidId(code)} ${klass}`)
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

  function applyZoom() {
    if (!props.interactive || !intrinsicWidth) return
    const svg = graphRef.value?.querySelector('svg')
    if (svg) svg.style.width = `${Math.ceil(intrinsicWidth * zoom.value)}px`
  }
  function changeZoom(delta: number) {
    zoom.value = Math.max(0.25, Math.min(3, zoom.value + delta))
    applyZoom()
  }
  function fitGraph() {
    if (!intrinsicWidth || !graphRef.value) return
    zoom.value = Math.max(0.25, Math.min(3, (graphRef.value.clientWidth - 32) / intrinsicWidth))
    applyZoom()
  }
  function resetZoom() {
    zoom.value = 1
    applyZoom()
  }

  let renderSequence = 0
  async function render() {
    const sequence = ++renderSequence
    renderError.value = ''
    if (!props.mermaidText.trim()) {
      clearTrustedSvg(graphRef.value)
      return
    }
    try {
      const mermaid = await loadMermaid()
      const overlaid = applyStateOverlay(props.mermaidText, props.nodeRuns ?? [])
      const renderId = `mini-dag-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const { svg } = await mermaid.render(renderId, overlaid)
      await nextTick()
      if (sequence === renderSequence) {
        setTrustedMermaidSvg(graphRef.value, svg)
        intrinsicWidth = graphRef.value?.querySelector('svg')?.viewBox.baseVal.width ?? 0
        if (props.autoFit) fitGraph()
        else applyZoom()
      }
    } catch (err: unknown) {
      if (sequence === renderSequence) renderError.value = userErrorMessage(err)
    }
  }

  onMounted(render)
  watch(
    () => [props.mermaidText, props.nodeRuns],
    () => void render(),
    { deep: true },
  )
  onBeforeUnmount(() => {
    renderSequence++
    clearTrustedSvg(graphRef.value)
  })
</script>

<style scoped>
  .mini-dag {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mini-dag__graph {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 120px;
    overflow: auto;
    background: var(--el-fill-color-blank);
    border: 1px dashed var(--el-border-color-lighter);
    border-radius: 4px;
    padding: 8px;
  }
  .mini-dag__graph :deep(svg) {
    max-width: 100%;
    height: auto;
  }
  .mini-dag__tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .mini-dag--interactive .mini-dag__graph {
    justify-content: flex-start;
  }
  .mini-dag--interactive .mini-dag__graph :deep(svg) {
    max-width: none;
    flex-shrink: 0;
  }
  .mini-dag__graph :deep(.node text) {
    text-anchor: middle;
  }
  /* 净化器有意移除内联样式，运行图使用组件自身的可信样式恢复状态和连线。 */
  .mini-dag__graph :deep(.node rect),
  .mini-dag__graph :deep(.node polygon),
  .mini-dag__graph :deep(.node path) {
    fill: var(--el-fill-color-light);
    stroke: var(--el-border-color);
  }
  .mini-dag__graph :deep(.node text),
  .mini-dag__graph :deep(.edgeLabel text) {
    fill: var(--color-text-primary);
  }
  .mini-dag__graph :deep(.node.success rect) {
    fill: var(--workflow-run-success-fill);
    stroke: var(--workflow-run-success-stroke);
  }
  .mini-dag__graph :deep(.node.running rect) {
    fill: var(--workflow-run-running-fill);
    stroke: var(--workflow-run-running-stroke);
  }
  .mini-dag__graph :deep(.node.failed rect) {
    fill: var(--workflow-run-failed-fill);
    stroke: var(--workflow-run-failed-stroke);
  }
  .mini-dag__graph :deep(.node.waiting rect) {
    fill: var(--workflow-run-waiting-fill);
    stroke: var(--workflow-run-waiting-stroke);
  }
  .mini-dag__graph :deep(.node.cancelled rect) {
    fill: var(--workflow-run-cancelled-fill);
    stroke: var(--workflow-run-cancelled-stroke);
  }
  .mini-dag__graph :deep(.node.success text) {
    fill: var(--workflow-run-success-text);
  }
  .mini-dag__graph :deep(.node.running text) {
    fill: var(--workflow-run-running-text);
  }
  .mini-dag__graph :deep(.node.failed text) {
    fill: var(--workflow-run-failed-text);
  }
  .mini-dag__graph :deep(.node.waiting text) {
    fill: var(--workflow-run-waiting-text);
  }
  .mini-dag__graph :deep(.node.cancelled text) {
    fill: var(--workflow-run-cancelled-text);
  }
  .mini-dag__graph :deep(path.flowchart-link) {
    fill: none;
    stroke: var(--color-text-secondary);
  }
  .mini-dag__graph :deep(marker path) {
    fill: var(--color-text-secondary);
    stroke: var(--color-text-secondary);
  }
  .mini-dag__graph :deep(.edgeLabel rect) {
    fill: var(--el-bg-color);
  }
  .mini-dag__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
