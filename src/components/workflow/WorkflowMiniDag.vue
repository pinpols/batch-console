<template>
  <div class="mini-dag">
    <DataState
      :loading="loading"
      :error="errorMessage"
      :empty="!loading && !mermaidText"
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
  import mermaid from 'mermaid'
  import DataState from '@/components/common/DataState.vue'
  import { clearTrustedSvg, setTrustedMermaidSvg } from '@/utils/trustedMermaidSvg'
  import {
    workflowRunMermaidClassDefs,
    workflowRunStatusClass,
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
    maxHeight?: number
    loading?: boolean
    errorMessage?: string
    emptyText?: string
  }>()

  const graphRef = ref<HTMLDivElement | null>(null)
  const graphStyle = computed(() => ({
    maxHeight: `${props.maxHeight ?? 280}px`,
  }))
  const errorMessage = ref<string>('')

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: { htmlLabels: true, curve: 'basis' },
    securityLevel: 'strict',
  })

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
      if (!prior || (r.id ?? 0) > (prior.id ?? 0)) latest.set(code, r)
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

  async function render() {
    errorMessage.value = ''
    if (!props.mermaidText.trim()) {
      clearTrustedSvg(graphRef.value)
      return
    }
    try {
      const overlaid = applyStateOverlay(props.mermaidText, props.nodeRuns ?? [])
      const renderId = `mini-dag-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const { svg } = await mermaid.render(renderId, overlaid)
      await nextTick()
      setTrustedMermaidSvg(graphRef.value, svg)
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
  }

  onMounted(render)
  watch(
    () => [props.mermaidText, props.nodeRuns],
    () => void render(),
    { deep: true },
  )
  onBeforeUnmount(() => {
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
  .mini-dag__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
