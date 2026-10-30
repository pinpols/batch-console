<script setup lang="ts">
  /**
   * Workflow 版本对比 diff(Polish 阶段)。
   *
   * 路由:`/workflow/designer/:id/diff/:fromVersion/:toVersion`
   *
   * 先读取后端持久版本目录，再按用户选择读取两个历史快照。两个快照都成功时才计算差异；任一侧不可用则显示不可比较和重试，
   * 避免将缺失快照误报为“全部新增”。
   *
   * 视觉:左右两个 readonly 小画布(纯 DOM 描述,无 X6 — 避免编辑事件污染 readonly 流),
   * 顶部 summary(增 / 删 / 改 计数),底部按 nodeCode 行列出每个 diff 项。
   */
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useTenantStore } from '@/stores/tenant'
  import {
    workflowDesignerApi,
    type WorkflowDefinitionVersionSummary,
  } from '@/api/workflowDesigner'
  import { logRoute } from '@/utils/logger'
  import {
    diffDefinitions,
    statusOfNodeInSide,
    type DefinitionDiff,
    type DiffStatus,
  } from './diffAlgorithm'
  import type { WorkflowDefinitionJson } from '../types'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const tenant = useTenantStore()

  const idRaw = route.params.id as string
  const fromVersion = computed(() => route.params.fromVersion as string)
  const toVersion = computed(() => route.params.toVersion as string)
  const workflowId = Number(idRaw)

  const loading = ref(false)
  type ListedWorkflowDefinitionVersion = WorkflowDefinitionVersionSummary & { version: number }
  const versionRows = ref<ListedWorkflowDefinitionVersion[]>([])
  const selectedFromVersion = ref<number | null>(null)
  const selectedToVersion = ref<number | null>(null)
  const fromDefinition = ref<WorkflowDefinitionJson>({ nodes: [], edges: [] })
  const toDefinition = ref<WorkflowDefinitionJson>({ nodes: [], edges: [] })
  const loadError = ref('')
  let requestSequence = 0

  const diff = computed<DefinitionDiff>(() =>
    diffDefinitions(fromDefinition.value, toDefinition.value),
  )

  function detailToDefinitionJson(detail: {
    nodes?: Array<Record<string, unknown>>
    edges?: Array<Record<string, unknown>>
  }): WorkflowDefinitionJson {
    return {
      nodes: (detail.nodes ?? []).map((n) => ({
        nodeCode: String(n.nodeCode ?? ''),
        nodeName: typeof n.nodeName === 'string' ? n.nodeName : undefined,
        nodeType: String(n.nodeType ?? 'JOB'),
        jobCode: n.relatedJobCode,
        pipelineCode: n.relatedPipelineCode,
      })),
      edges: (detail.edges ?? []).map((e) => ({
        sourceNodeCode: String(e.fromNodeCode ?? ''),
        targetNodeCode: String(e.toNodeCode ?? ''),
        label: typeof e.conditionExpr === 'string' ? e.conditionExpr : undefined,
      })),
    }
  }

  function versionLabel(row: (typeof versionRows.value)[number]): string {
    const version = typeof row.version === 'number' ? `v${row.version}` : '—'
    const currentLabel = row.current ? ` · ${t('workflowDesignerPolish.versionCurrent')}` : ''
    const savedByLabel = row.savedBy ? ` · ${row.savedBy}` : ''
    const savedAtLabel = row.savedAt ? ` · ${row.savedAt}` : ''
    return `${version}${currentLabel}${savedByLabel}${savedAtLabel}`
  }

  async function loadComparison() {
    const sequence = ++requestSequence
    const tenantId = tenant.tenantId
    if (Number.isNaN(workflowId)) {
      loadError.value = t('workflowDesignerPolish.diffInvalidId')
      return
    }
    if (!tenantId.trim()) {
      loadError.value = t('workflowDesignerPolish.diffTenantRequired')
      loading.value = false
      return
    }
    loading.value = true
    loadError.value = ''
    fromDefinition.value = { nodes: [], edges: [] }
    toDefinition.value = { nodes: [], edges: [] }
    try {
      const versions = await workflowDesignerApi.listVersions(workflowId, tenantId)
      if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
      versionRows.value = (versions ?? []).filter(
        (row): row is ListedWorkflowDefinitionVersion =>
          typeof row.version === 'number' && Number.isInteger(row.version),
      )
      const availableVersions = versionRows.value.map((row) => row.version as number)
      if (availableVersions.length < 2) {
        loadError.value = t('workflowDesignerPolish.diffInsufficientVersions')
        return
      }
      const routeFrom = Number(fromVersion.value)
      const routeTo = Number(toVersion.value)
      const currentVersion =
        versionRows.value.find((row) => row.current)?.version ?? availableVersions[0]
      selectedToVersion.value = availableVersions.includes(selectedToVersion.value ?? routeTo)
        ? (selectedToVersion.value ?? routeTo)
        : currentVersion
      const fallbackFrom = availableVersions.find((version) => version !== selectedToVersion.value)
      selectedFromVersion.value = availableVersions.includes(selectedFromVersion.value ?? routeFrom)
        ? (selectedFromVersion.value ?? routeFrom)
        : (fallbackFrom ?? null)
      const fromV = selectedFromVersion.value
      const toV = selectedToVersion.value
      if (fromV == null || toV == null || fromV === toV) {
        loadError.value = t('workflowDesignerPolish.diffInvalidVersion')
        return
      }
      const [fromDetail, toDetail] = await Promise.all([
        workflowDesignerApi.getVersion(workflowId, fromV, tenantId),
        workflowDesignerApi.getVersion(workflowId, toV, tenantId),
      ])
      if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
      fromDefinition.value = detailToDefinitionJson(fromDetail as never)
      toDefinition.value = detailToDefinitionJson(toDetail as never)
    } catch (err) {
      if (sequence !== requestSequence || tenant.tenantId !== tenantId) return
      logRoute('[designer-diff] version comparison unavailable', { err: String(err) })
      loadError.value = t('workflowDesignerPolish.diffUnavailableDescription')
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      versionRows.value = []
      selectedFromVersion.value = null
      selectedToVersion.value = null
      void loadComparison()
    },
    { immediate: true },
  )

  async function applyVersionComparison() {
    if (selectedFromVersion.value == null || selectedToVersion.value == null) return
    await router.replace({
      path: `/workflow/designer/${workflowId}/diff/${selectedFromVersion.value}/${selectedToVersion.value}`,
    })
    await loadComparison()
  }

  function back() {
    void router.push({ path: `/workflow/designer/${workflowId}` })
  }

  function nodeBoxClass(status: DiffStatus): string {
    return `diff-node--${status}`
  }
</script>

<template>
  <div v-loading="loading" class="diff-page">
    <div class="diff-page__header">
      <el-button @click="back">{{ t('workflowDesignerPolish.diffBack') }}</el-button>
      <span class="diff-page__title">{{ t('workflowDesignerPolish.diffViewerTitle') }}</span>
      <el-select
        v-model="selectedFromVersion"
        :disabled="loading || versionRows.length < 2"
        :placeholder="t('workflowDesignerPolish.diffFromPlaceholder')"
        class="diff-page__version-select"
      >
        <el-option
          v-for="row in versionRows"
          :key="row.version"
          :label="versionLabel(row)"
          :value="row.version"
          :disabled="row.version === selectedToVersion"
        />
      </el-select>
      <span aria-hidden="true">→</span>
      <el-select
        v-model="selectedToVersion"
        :disabled="loading || versionRows.length < 2"
        :placeholder="t('workflowDesignerPolish.diffToPlaceholder')"
        class="diff-page__version-select"
      >
        <el-option
          v-for="row in versionRows"
          :key="row.version"
          :label="versionLabel(row)"
          :value="row.version"
          :disabled="row.version === selectedFromVersion"
        />
      </el-select>
      <el-button
        type="primary"
        :disabled="loading || selectedFromVersion == null || selectedToVersion == null"
        @click="applyVersionComparison"
      >
        {{ t('workflowDesignerPolish.diffCompare') }}
      </el-button>
    </div>

    <el-result
      v-if="loadError"
      icon="warning"
      :title="t('workflowDesignerPolish.diffUnavailableTitle')"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" @click="loadComparison">
          {{ t('common.retry') }}
        </el-button>
      </template>
    </el-result>

    <template v-else>
      <div class="diff-page__summary">
        <span class="diff-summary diff-summary--added">
          {{ t('workflowDesignerPolish.diffLegendAdded') }}: {{ diff.summary.added }}
        </span>
        <span class="diff-summary diff-summary--removed">
          {{ t('workflowDesignerPolish.diffLegendRemoved') }}: {{ diff.summary.removed }}
        </span>
        <span class="diff-summary diff-summary--modified">
          {{ t('workflowDesignerPolish.diffLegendModified') }}: {{ diff.summary.modified }}
        </span>
        <span class="diff-summary">
          {{ t('workflowDesignerPolish.diffLegendUnchanged') }}: {{ diff.summary.unchanged }}
        </span>
      </div>

      <div class="diff-page__canvases">
        <div class="diff-canvas" :aria-label="t('workflowDesignerPolish.diffSideFrom')">
          <div class="diff-canvas__title">
            {{ t('workflowDesignerPolish.diffSideFrom') }}
            (v{{ selectedFromVersion ?? fromVersion }})
          </div>
          <div class="diff-canvas__nodes">
            <div
              v-for="n in fromDefinition.nodes"
              :key="n.nodeCode"
              class="diff-node"
              :class="nodeBoxClass(statusOfNodeInSide(diff, n.nodeCode, 'from'))"
            >
              <div class="diff-node__type">{{ n.nodeType }}</div>
              <div class="diff-node__code">{{ n.nodeCode }}</div>
            </div>
            <div v-if="fromDefinition.nodes.length === 0" class="diff-canvas__empty">
              {{ t('workflowDesignerPolish.diffEmptySide') }}
            </div>
          </div>
        </div>
        <div class="diff-canvas" :aria-label="t('workflowDesignerPolish.diffSideTo')">
          <div class="diff-canvas__title">
            {{ t('workflowDesignerPolish.diffSideTo') }} (v{{ selectedToVersion ?? toVersion }})
          </div>
          <div class="diff-canvas__nodes">
            <div
              v-for="n in toDefinition.nodes"
              :key="n.nodeCode"
              class="diff-node"
              :class="nodeBoxClass(statusOfNodeInSide(diff, n.nodeCode, 'to'))"
            >
              <div class="diff-node__type">{{ n.nodeType }}</div>
              <div class="diff-node__code">{{ n.nodeCode }}</div>
            </div>
            <div v-if="toDefinition.nodes.length === 0" class="diff-canvas__empty">
              {{ t('workflowDesignerPolish.diffEmptySide') }}
            </div>
          </div>
        </div>
      </div>

      <div class="diff-page__details">
        <h4>{{ t('workflowDesignerPolish.diffDetailsTitle') }}</h4>
        <table class="diff-table">
          <thead>
            <tr>
              <th>{{ t('workflowDesignerPolish.diffColNodeCode') }}</th>
              <th>{{ t('workflowDesignerPolish.diffColStatus') }}</th>
              <th>{{ t('workflowDesignerPolish.diffColFrom') }}</th>
              <th>{{ t('workflowDesignerPolish.diffColTo') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in diff.nodes" :key="entry.nodeCode">
              <td class="diff-table__code">{{ entry.nodeCode }}</td>
              <td>
                <span class="diff-badge" :class="`diff-badge--${entry.status}`">
                  {{ t(`workflowDesignerPolish.diffStatus_${entry.status}`) }}
                </span>
              </td>
              <td>{{ entry.fromNode?.nodeType ?? '-' }}</td>
              <td>{{ entry.toNode?.nodeType ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
  .diff-page {
    padding: 16px;
    min-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .diff-page__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .diff-page__title {
    font-size: 16px;
    font-weight: 600;
  }
  .diff-page__versions {
    font-family: monospace;
    color: var(--color-text-secondary, #606266);
  }

  .diff-page__version-select {
    width: min(260px, 28vw);
  }
  .diff-page__notice {
    font-size: 12px;
    color: var(--color-warning, #e6a23c);
  }
  .diff-page__summary {
    display: flex;
    gap: 16px;
    font-size: 13px;
  }
  .diff-summary {
    padding: 4px 12px;
    border-radius: 4px;
    background: var(--color-bg-base, #fafafa);
  }
  .diff-summary--added {
    background: var(--el-color-success-light-9);
    color: var(--color-success, #67c23a);
  }
  .diff-summary--removed {
    background: var(--el-color-info-light-9);
    color: var(--color-text-secondary, #909399);
  }
  .diff-summary--modified {
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
  }
  .diff-page__canvases {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-height: 320px;
  }
  .diff-canvas {
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 12px;
    background: var(--color-bg-overlay, #fff);
  }
  .diff-canvas__title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--color-text-primary, #303133);
  }
  .diff-canvas__nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 200px;
  }
  .diff-canvas__empty {
    width: 100%;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-secondary, #909399);
    padding: 32px 0;
  }
  .diff-node {
    border: 2px solid var(--color-border);
    border-radius: 4px;
    padding: 6px 10px;
    background: var(--color-bg-base, #fafafa);
    min-width: 100px;
  }
  .diff-node__type {
    font-size: 10px;
    font-family: monospace;
    color: var(--color-text-secondary, #909399);
  }
  .diff-node__code {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary, #303133);
  }
  .diff-node--added {
    border-color: var(--color-success, #67c23a);
    background: var(--el-color-success-light-9);
  }
  .diff-node--removed {
    border-color: var(--color-text-secondary, #909399);
    background: var(--el-color-info-light-9);
    opacity: 0.7;
  }
  .diff-node--modified {
    border-color: var(--color-warning, #e6a23c);
    background: var(--el-color-warning-light-9);
  }
  .diff-page__details {
    margin-top: 8px;
  }
  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .diff-table th,
  .diff-table td {
    border: 1px solid var(--color-border-light, #ebeef5);
    padding: 6px 10px;
    text-align: left;
  }
  .diff-table__code {
    font-family: monospace;
  }
  .diff-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
  }
  .diff-badge--added {
    background: var(--el-color-success-light-9);
    color: var(--color-success, #67c23a);
  }
  .diff-badge--removed {
    background: var(--el-color-info-light-9);
    color: var(--color-text-secondary, #909399);
  }
  .diff-badge--modified {
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
  }
  .diff-badge--unchanged {
    background: var(--color-bg-base, #fafafa);
    color: var(--color-text-secondary, #909399);
  }
</style>
