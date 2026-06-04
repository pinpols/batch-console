<script setup lang="ts">
/**
 * Workflow DAG 设计器顶层容器(MVP 阶段)。
 *
 * 布局:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Toolbar(undo / redo / 自动布局 / 校验 / 保存 / Mermaid) │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ ErrorBanner(校验错误数 + 展开)                          │
 *   │ LockBanner(他人持锁只读提示)                            │
 *   ├────────┬────────────────────────────┬───────────────────┤
 *   │ Palette│ Canvas(X6)+ mini-map     │ Inspector          │
 *   └────────┴────────────────────────────┴───────────────────┘
 *
 * 数据流:
 * - mount → workflowDesignerApi.getFull(:id) → 填 store.meta + reset(snapshot) →
 *   useLockManager.acquire → setLock(isMine / readonly)
 * - 保存 → validateDag → 有错弹 drawer;无错走 putFull(/full) + markClean
 * - 锁丢失(续期失败/被夺) → setLock 只读 + banner
 * - onUnmounted → useLockManager 内置 release + beforeunload sendBeacon 兜底
 */

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import { useDesignerStore } from './store/useDesignerStore'
import { exportMermaid } from './codec/mermaidExporter'
import { graphToDefinition } from './codec/graphToDefinition'
import { definitionToGraph } from './codec/definitionToGraph'
import { validateDag } from './validators/dagValidators'
import { workflowDesignerApi } from '@/api/workflowDesigner'
import { useLockManager } from '@/composables/useLockManager'
import { logRoute } from '@/utils/logger'
import DagCanvas from './canvas/DagCanvas.vue'
import DesignerToolbar from './toolbar/DesignerToolbar.vue'
import NodePalette from './toolbar/NodePalette.vue'
import NodeInspector from './inspector/NodeInspector.vue'

const route = useRoute()
const { t } = useI18n()
const tenantStore = useTenantStore()

const store = useDesignerStore()
const canvasRef = ref<InstanceType<typeof DagCanvas> | null>(null)
const mermaidDialogVisible = ref(false)
const mermaidText = ref('')
const errorDrawerVisible = ref(false)
const saving = ref(false)
const loading = ref(false)

const workflowIdRaw = route.params.id as string | undefined
const workflowId = workflowIdRaw ? Number(workflowIdRaw) : null

const lockMgr = useLockManager({
  onLost: (reason) => {
    ElMessage.warning(t(`workflowDesignerMvp.lock.lost_${reason}`))
  },
})

const errorCount = computed(() => store.validationErrors.length)
const readonlyBanner = computed(() => {
  const lock = store.lock
  return lock && !lock.isMine && lock.lockedBy ? lock : null
})

onMounted(async () => {
  store.reset({ nodes: [], edges: [] })
  if (workflowId == null || Number.isNaN(workflowId)) {
    logRoute('[designer] mounted (new)', { tenantId: tenantStore.tenantId })
    return
  }
  loading.value = true
  try {
    const detail = await workflowDesignerApi.getFull(workflowId, tenantStore.tenantId)
    // 反序列化 BE detail → designer snapshot。BE 的 ConsoleWorkflowNodeResponse
    // 字段名(relatedJobCode / relatedPipelineCode / nodeParams JSON 等)与设计书的
    // attrs key(jobCode / pipelineCode 等)之间走显式映射 + attrs 透传保底。
    const defJson = {
      nodes: (detail.nodes ?? []).map((n) => {
        const raw = n as unknown as Record<string, unknown>
        const nodeParamsRaw = typeof raw.nodeParams === 'string' ? raw.nodeParams : ''
        let parsedParams: Record<string, unknown> = {}
        if (nodeParamsRaw) {
          try {
            const obj = JSON.parse(nodeParamsRaw)
            if (obj && typeof obj === 'object') parsedParams = obj as Record<string, unknown>
          } catch {
            // 非 JSON 静默忽略
          }
        }
        return {
          nodeCode: n.nodeCode,
          nodeName: n.nodeName,
          nodeType: n.nodeType,
          // attrs 形态:把 BE 列名平翻成 inspector 期待的 key
          ...parsedParams,
          jobCode: parsedParams.jobCode ?? raw.relatedJobCode,
          pipelineCode: parsedParams.pipelineCode ?? raw.relatedPipelineCode,
          maxRetries: parsedParams.maxRetries ?? raw.retryMaxCount,
          timeoutSeconds: parsedParams.timeoutSeconds ?? raw.timeoutSeconds,
        }
      }),
      edges: (detail.edges ?? []).map((e) => {
        const raw = e as unknown as Record<string, unknown>
        return {
          sourceNodeCode: typeof raw.fromNodeCode === 'string' ? raw.fromNodeCode : '',
          targetNodeCode: typeof raw.toNodeCode === 'string' ? raw.toNodeCode : '',
          label: typeof raw.conditionExpr === 'string' ? raw.conditionExpr : undefined,
        }
      }),
    }
    store.reset(definitionToGraph(defJson))
    store.setMeta({
      id: detail.id,
      tenantId: detail.tenantId,
      workflowCode: detail.workflowCode,
      workflowName: detail.workflowName,
      workflowType: detail.workflowType,
      enabled: detail.enabled,
      description: detail.description,
      version: detail.version,
    })
    await lockMgr.acquire(workflowId, tenantStore.tenantId)
  } catch (err) {
    logRoute('[designer] load failed', { err: String(err) })
    ElMessage.error(t('workflowDesignerMvp.loadFailed'))
  } finally {
    loading.value = false
  }
})

// useLockManager 内部已在 onBeforeUnmount 兜底 release + beforeunload sendBeacon

function onAutoLayout() {
  canvasRef.value?.autoLayout()
}

function runValidation(): boolean {
  const errs = validateDag(store.snapshot)
  store.setValidationErrors(errs)
  return errs.length === 0
}

function onValidate() {
  if (runValidation()) {
    ElMessage.success(t('workflowDesignerMvp.validateOk'))
  } else {
    errorDrawerVisible.value = true
  }
}

async function onSave() {
  if (!store.editable) {
    ElMessage.warning(t('workflowDesignerMvp.lock.cannotSaveReadonly'))
    return
  }
  if (workflowId == null || Number.isNaN(workflowId)) {
    ElMessage.warning(t('workflowDesignerMvp.saveNeedsId'))
    return
  }
  if (!runValidation()) {
    errorDrawerVisible.value = true
    return
  }
  saving.value = true
  try {
    const def = graphToDefinition(store.snapshot)
    // BE WorkflowDefinitionFullUpdateRequest 是 nested:{ definition: SaveRequest, expectedVersion, lockToken }
    // SaveRequest 内含 tenantId / workflowCode / workflowName / workflowType / enabled / nodes / edges
    // expectedVersion 与 lockToken 是顶层(乐观锁 + 锁归属预留)
    const body = {
      definition: {
        tenantId: store.meta.tenantId,
        workflowCode: store.meta.workflowCode,
        workflowName: store.meta.workflowName,
        workflowType: store.meta.workflowType,
        enabled: store.meta.enabled,
        nodes: def.nodes.map((n) => {
          const a = (n as unknown as Record<string, unknown>) ?? {}
          return {
            nodeCode: n.nodeCode,
            nodeName: n.nodeName ?? n.nodeCode,
            nodeType: n.nodeType,
            relatedJobCode: typeof a.jobCode === 'string' ? a.jobCode : undefined,
            relatedPipelineCode:
              typeof a.pipelineCode === 'string' ? a.pipelineCode : undefined,
            retryMaxCount: typeof a.maxRetries === 'number' ? a.maxRetries : undefined,
            timeoutSeconds: typeof a.timeoutSeconds === 'number' ? a.timeoutSeconds : undefined,
            nodeParams: JSON.stringify(a),
          }
        }),
        edges: def.edges.map((e) => ({
          fromNodeCode: e.sourceNodeCode,
          toNodeCode: e.targetNodeCode,
          edgeType: 'NEXT',
          conditionExpr: typeof e.label === 'string' ? e.label : undefined,
        })),
      },
      expectedVersion: store.meta.version,
    }
    const updated = await workflowDesignerApi.putFull(workflowId, body)
    store.setMeta({ version: updated.version })
    store.markClean()
    ElMessage.success(t('workflowDesignerMvp.saveOk'))
  } catch (err) {
    const ax = err as { response?: { status?: number; data?: Record<string, unknown> } }
    const status = ax?.response?.status
    if (status === 409) {
      const payload = (ax.response?.data?.data as Record<string, unknown>) ?? ax.response?.data ?? {}
      const lockedBy = typeof payload?.lockedBy === 'string' ? payload.lockedBy : ''
      if (lockedBy) {
        await ElMessageBox.alert(
          t('workflowDesignerMvp.lock.editingBy', { who: lockedBy }),
          t('workflowDesignerMvp.lock.conflictTitle'),
          { confirmButtonText: t('common.ok') },
        )
      } else {
        await ElMessageBox.alert(
          t('workflowDesignerMvp.versionConflict'),
          t('workflowDesignerMvp.versionConflictTitle'),
          { confirmButtonText: t('common.ok') },
        )
      }
    } else {
      logRoute('[designer] save failed', { status, err: String(err) })
    }
  } finally {
    saving.value = false
  }
}

function onExportMermaid() {
  mermaidText.value = exportMermaid(store.snapshot)
  mermaidDialogVisible.value = true
}
</script>

<template>
  <div v-loading="loading" class="workflow-designer">
    <DesignerToolbar
      :saving="saving"
      :can-save="store.editable"
      @auto-layout="onAutoLayout"
      @validate="onValidate"
      @save="onSave"
      @export-mermaid="onExportMermaid"
    />
    <div
      v-if="readonlyBanner"
      class="workflow-designer__banner workflow-designer__banner--readonly"
    >
      {{ t('workflowDesignerMvp.lock.readonlyBanner', { who: readonlyBanner.lockedBy }) }}
    </div>
    <div
      v-if="errorCount > 0"
      class="workflow-designer__banner workflow-designer__banner--error"
      role="button"
      tabindex="0"
      :aria-label="t('workflowDesignerMvp.errorBannerAria')"
      @click="errorDrawerVisible = true"
      @keydown.enter="errorDrawerVisible = true"
    >
      {{ t('workflowDesignerMvp.errorBanner', { count: errorCount }) }}
    </div>
    <div class="workflow-designer__body">
      <NodePalette />
      <DagCanvas ref="canvasRef" />
      <NodeInspector />
    </div>

    <el-drawer
      v-model="errorDrawerVisible"
      :title="t('workflowDesignerMvp.errorDrawerTitle')"
      direction="rtl"
      size="380px"
    >
      <ul class="error-list">
        <li v-for="(e, idx) in store.validationErrors" :key="idx" class="error-list__item">
          <span v-if="e.nodeId" class="error-list__node">[{{ e.nodeId }}]</span>
          {{ t(e.messageKey, (e.args ?? {}) as Record<string, unknown>) }}
        </li>
      </ul>
    </el-drawer>

    <el-dialog
      v-model="mermaidDialogVisible"
      :title="t('workflowDesignerSpike.mermaidDialogTitle')"
      width="600px"
    >
      <el-input
        v-model="mermaidText"
        type="textarea"
        :rows="12"
        readonly
        :aria-label="t('workflowDesignerSpike.mermaidDialogTitle')"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.workflow-designer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 60px);
}
.workflow-designer__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
.workflow-designer__banner {
  padding: 8px 16px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
  cursor: pointer;
}
.workflow-designer__banner--readonly {
  background: var(--color-warning-light, #fdf6ec);
  color: var(--color-warning-dark, #b88230);
  cursor: default;
}
.workflow-designer__banner--error {
  background: var(--color-danger-light, #fef0f0);
  color: var(--color-danger, #f56c6c);
}
.error-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.error-list__item {
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
  font-size: 12px;
  color: var(--color-text-primary, #303133);
}
.error-list__node {
  color: var(--color-danger, #f56c6c);
  margin-right: 4px;
  font-family: monospace;
}
</style>
