<script setup lang="ts">
  /**
   * 右侧节点 Inspector 容器(MVP 阶段)。
   *
   * 行为:
   *  - 监听 store.selectedIds 取第一个节点 → 按 nodeType 分发到子表单
   *  - 多选 / 无选 → 显示提示空态
   *  - 只读态(store.editable=false)→ 所有子表单 readonly,UI 提示
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import StartNodeForm from './StartNodeForm.vue'
  import EndNodeForm from './EndNodeForm.vue'
  import JobNodeForm from './JobNodeForm.vue'
  import FileStepNodeForm from './FileStepNodeForm.vue'
  import GatewayNodeForm from './GatewayNodeForm.vue'
  import ApprovalNodeForm from './ApprovalNodeForm.vue'
  import EdgeInspector from './EdgeInspector.vue'

  const { t } = useI18n()
  const store = useDesignerStore()

  const selectedNode = computed(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length !== 1) return null
    return store.nodes.find((n) => n.id === ids[0]) ?? null
  })

  const selectedEdge = computed(() => {
    const ids = Array.from(store.selectedIds)
    if (ids.length !== 1) return null
    return store.edges.find((edge) => edge.id === ids[0]) ?? null
  })

  const readonly = computed(() => !store.editable)
</script>

<template>
  <aside class="node-inspector" :aria-label="t('workflowDesignerMvp.inspectorAriaLabel')">
    <div class="node-inspector__header">
      <span class="node-inspector__title">{{ t('workflowDesignerMvp.inspectorTitle') }}</span>
      <el-tag v-if="readonly" type="info" size="small">
        {{ t('workflowDesignerMvp.readonlyTag') }}
      </el-tag>
    </div>
    <div v-if="!selectedNode && !selectedEdge" class="node-inspector__empty">
      {{
        Array.from(store.selectedIds).length > 1
          ? t('workflowDesignerMvp.multiSelectNotice')
          : t('workflowDesignerMvp.noSelectNotice')
      }}
    </div>
    <EdgeInspector v-else-if="selectedEdge" :edge="selectedEdge" :readonly="readonly" />
    <template v-else>
      <StartNodeForm
        v-if="selectedNode.nodeType === 'START'"
        :node="selectedNode"
        :readonly="readonly"
      />
      <EndNodeForm
        v-else-if="selectedNode.nodeType === 'END'"
        :node="selectedNode"
        :readonly="readonly"
      />
      <JobNodeForm
        v-else-if="selectedNode.nodeType === 'JOB'"
        :node="selectedNode"
        :readonly="readonly"
      />
      <FileStepNodeForm
        v-else-if="selectedNode.nodeType === 'FILE_STEP'"
        :node="selectedNode"
        :readonly="readonly"
      />
      <GatewayNodeForm
        v-else-if="selectedNode.nodeType === 'GATEWAY'"
        :node="selectedNode"
        :readonly="readonly"
      />
      <ApprovalNodeForm
        v-else-if="selectedNode.nodeType === 'APPROVAL'"
        :node="selectedNode"
        :readonly="readonly"
      />
    </template>
  </aside>
</template>

<style scoped>
  .node-inspector {
    width: 320px;
    border-left: 1px solid var(--color-border);
    background: var(--color-bg-overlay, #fff);
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .node-inspector__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .node-inspector__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary, #303133);
  }
  .node-inspector__empty {
    font-size: 12px;
    color: var(--color-text-secondary, #909399);
    text-align: center;
    padding: 24px 8px;
  }
</style>
