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
  import { X } from 'lucide-vue-next'
  import { useDesignerStore } from '../store/useDesignerStore'
  import StartNodeForm from './StartNodeForm.vue'
  import EndNodeForm from './EndNodeForm.vue'
  import JobNodeForm from './JobNodeForm.vue'
  import FileStepNodeForm from './FileStepNodeForm.vue'
  import GatewayNodeForm from './GatewayNodeForm.vue'
  import ApprovalNodeForm from './ApprovalNodeForm.vue'
  import EdgeInspector from './EdgeInspector.vue'
  import { edgeTypeOf } from '../canvas/edgePresentation'

  const { t } = useI18n()
  const store = useDesignerStore()
  const emit = defineEmits<{ (e: 'close'): void }>()

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

  const selectedEdgeId = computed(() => selectedEdge.value?.id ?? '')

  function nodeLabel(nodeId: string): string {
    const node = store.nodes.find((item) => item.id === nodeId)
    if (!node) return nodeId
    return node.nodeName === node.nodeCode ? node.nodeCode : `${node.nodeName} (${node.nodeCode})`
  }

  function edgeOptionLabel(edge: (typeof store.edges)[number]): string {
    const type = edgeTypeOf(edge)
    return `${nodeLabel(edge.source)} → ${nodeLabel(edge.target)} · ${t(`enum.edgeType.${type}`)}`
  }

  function selectEdge(edgeId: string) {
    store.setSelection(edgeId ? [edgeId] : [])
  }
</script>

<template>
  <aside class="node-inspector" :aria-label="t('workflowDesignerMvp.inspectorAriaLabel')">
    <div class="node-inspector__header">
      <span class="node-inspector__title">{{ t('workflowDesignerMvp.inspectorTitle') }}</span>
      <div class="node-inspector__header-actions">
        <el-tag v-if="readonly" type="info" size="small">
          {{ t('workflowDesignerMvp.readonlyTag') }}
        </el-tag>
        <el-button
          text
          circle
          size="small"
          :icon="X"
          :title="t('workflowDesignerMvp.layout.closeInspector')"
          :aria-label="t('workflowDesignerMvp.layout.closeInspector')"
          @click="emit('close')"
        />
      </div>
    </div>
    <el-select
      v-if="store.edges.length > 0"
      class="node-inspector__dependency-picker"
      :model-value="selectedEdgeId"
      :placeholder="t('workflowDesignerMvp.dependencyPickerPlaceholder')"
      :aria-label="t('workflowDesignerMvp.dependencyPickerAria')"
      filterable
      clearable
      @change="selectEdge(String($event ?? ''))"
    >
      <el-option
        v-for="edge in store.edges"
        :key="edge.id"
        :label="edgeOptionLabel(edge)"
        :value="edge.id"
      />
    </el-select>
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
    width: 100%;
    min-width: 0;
    border: 1px solid var(--color-border-light);
    border-left: none;
    border-radius: 0 var(--radius-content) var(--radius-content) 0;
    background: var(--color-bg-card, #fff);
    padding: 14px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 10px 24px color-mix(in srgb, #1f2937 5%, transparent);
  }
  .node-inspector__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border-light);
  }
  .node-inspector__title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-primary, #303133);
  }
  .node-inspector__header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .node-inspector__empty {
    font-size: 12px;
    color: var(--color-text-secondary, #909399);
    text-align: center;
    padding: 32px 8px;
    line-height: 1.6;
  }
  .node-inspector__dependency-picker {
    width: 100%;
  }
</style>
