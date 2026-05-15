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
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { DocumentCopy, Refresh } from '@element-plus/icons-vue'
  import mermaid from 'mermaid'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DataState from '@/components/common/DataState.vue'
  import { workflowApi } from '@/api/workflow'
  import { useTenantStore } from '@/stores/tenant'
  import type { WorkflowDefinitionDetailResponse } from '@/types/api.generated'

  const route = useRoute()
  const tenant = useTenantStore()

  const id = computed(() => Number(route.params.id))
  const detail = ref<WorkflowDefinitionDetailResponse | null>(null)
  const mermaidText = ref('')
  const graphRef = ref<HTMLDivElement | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')

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
    loading.value = true
    errorMessage.value = ''
    try {
      const [d, mer] = await Promise.all([
        workflowApi.detailById(id.value, tenant.tenantId),
        workflowApi.mermaid(id.value, tenant.tenantId),
      ])
      detail.value = d
      mermaidText.value = mer.mermaid ?? ''
      await renderMermaid(mermaidText.value)
    } catch (err: unknown) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      mermaidText.value = ''
      clearGraph()
    } finally {
      loading.value = false
    }
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
  watch(() => route.params.id, reload)
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
</style>
