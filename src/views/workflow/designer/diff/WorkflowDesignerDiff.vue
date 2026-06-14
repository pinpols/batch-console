<script setup lang="ts">
/**
 * Workflow 版本对比 diff(Polish 阶段)。
 *
 * 路由:`/workflow/designer/:id/diff/:fromVersion/:toVersion`
 *
 * 数据来源:BE 已提供版本快照端点 `GET /{id}/versions/{version}`(V167,返回与 getFull
 * 同款 WorkflowDefinitionDetailResponse)。按路由 fromVersion/toVersion 拉两个真实快照对比。
 * 降级:版本号非法 / 某快照拉取失败时,回退「当前 definition 作 to + 空 from」(展示 added 全集),
 * 顶部 notice 提示已降级。
 *
 * 视觉:左右两个 readonly 小画布(纯 DOM 描述,无 X6 — 避免编辑事件污染 readonly 流),
 * 顶部 summary(增 / 删 / 改 计数),底部按 nodeCode 行列出每个 diff 项。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import { workflowDesignerApi } from '@/api/workflowDesigner'
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
const fromVersion = route.params.fromVersion as string
const toVersion = route.params.toVersion as string
const workflowId = Number(idRaw)

const loading = ref(false)
const fromDefinition = ref<WorkflowDefinitionJson>({ nodes: [], edges: [] })
const toDefinition = ref<WorkflowDefinitionJson>({ nodes: [], edges: [] })
const versionListAvailable = ref(false)

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

onMounted(async () => {
  if (Number.isNaN(workflowId)) {
    ElMessage.error(t('workflowDesignerPolish.diffInvalidId'))
    return
  }
  loading.value = true
  try {
    // BE 已提供版本快照端点(/{id}/versions/{version},返回与 getFull 同款 detail);
    // 优先按路由 from/to 版本号拉真实快照做对比。版本号非法或拉取失败 → 回退到
    // 「当前 vs 空」降级(兼容历史:无版本数据时仍展示 added 全集)。
    const fromV = Number(fromVersion)
    const toV = Number(toVersion)
    if (Number.isFinite(fromV) && Number.isFinite(toV)) {
      const [fromDetail, toDetail] = await Promise.all([
        workflowDesignerApi.getVersion(workflowId, fromV, tenant.tenantId),
        workflowDesignerApi.getVersion(workflowId, toV, tenant.tenantId),
      ])
      fromDefinition.value = detailToDefinitionJson(fromDetail as never)
      toDefinition.value = detailToDefinitionJson(toDetail as never)
      versionListAvailable.value = true
    } else {
      const current = await workflowDesignerApi.getFull(workflowId, tenant.tenantId)
      toDefinition.value = detailToDefinitionJson(current as never)
      fromDefinition.value = { nodes: [], edges: [] }
      versionListAvailable.value = false
    }
  } catch (err) {
    logRoute('[designer-diff] version load failed, falling back to current', {
      err: String(err),
    })
    // 降级兜底:版本端点拉取失败(如该版本快照不存在)时退回「当前 vs 空」
    try {
      const current = await workflowDesignerApi.getFull(workflowId, tenant.tenantId)
      toDefinition.value = detailToDefinitionJson(current as never)
      fromDefinition.value = { nodes: [], edges: [] }
      versionListAvailable.value = false
    } catch (err2) {
      logRoute('[designer-diff] load failed', { err: String(err2) })
      ElMessage.error(t('workflowDesignerPolish.diffLoadFailed'))
    }
  } finally {
    loading.value = false
  }
})

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
      <span class="diff-page__versions">v{{ fromVersion }} → v{{ toVersion }}</span>
      <span v-if="!versionListAvailable" class="diff-page__notice">
        {{ t('workflowDesignerPolish.diffNoVersionEndpoint') }}
      </span>
    </div>

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
          {{ t('workflowDesignerPolish.diffSideFrom') }} (v{{ fromVersion }})
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
          {{ t('workflowDesignerPolish.diffSideTo') }} (v{{ toVersion }})
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
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-base, #dcdfe6);
}
.diff-page__title {
  font-size: 16px;
  font-weight: 600;
}
.diff-page__versions {
  font-family: monospace;
  color: var(--color-text-secondary, #606266);
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
  background: var(--color-success-light, #f0f9eb);
  color: var(--color-success, #67c23a);
}
.diff-summary--removed {
  background: var(--color-info-light, #f4f4f5);
  color: var(--color-text-secondary, #909399);
}
.diff-summary--modified {
  background: var(--color-warning-light, #fdf6ec);
  color: var(--color-warning-dark, #b88230);
}
.diff-page__canvases {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 320px;
}
.diff-canvas {
  border: 1px solid var(--color-border-base, #dcdfe6);
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
  border: 2px solid var(--color-border-base, #dcdfe6);
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
  background: var(--color-success-light, #f0f9eb);
}
.diff-node--removed {
  border-color: var(--color-text-secondary, #909399);
  background: var(--color-info-light, #f4f4f5);
  opacity: 0.7;
}
.diff-node--modified {
  border-color: var(--color-warning, #e6a23c);
  background: var(--color-warning-light, #fdf6ec);
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
  background: var(--color-success-light, #f0f9eb);
  color: var(--color-success, #67c23a);
}
.diff-badge--removed {
  background: var(--color-info-light, #f4f4f5);
  color: var(--color-text-secondary, #909399);
}
.diff-badge--modified {
  background: var(--color-warning-light, #fdf6ec);
  color: var(--color-warning-dark, #b88230);
}
.diff-badge--unchanged {
  background: var(--color-bg-base, #fafafa);
  color: var(--color-text-secondary, #909399);
}
</style>
