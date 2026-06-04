<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'

const { t } = useI18n()
const store = useDesignerStore()

withDefaults(
  defineProps<{
    saving?: boolean
    canSave?: boolean
    /** dagre 布局方向(Polish 阶段:可在 TB/LR 切换);默认 TB 维持向后兼容 */
    layoutDirection?: 'TB' | 'LR'
    /** JSON 同步面板当前展开状态(用于 button aria-pressed),默认折叠 */
    jsonPanelOpen?: boolean
  }>(),
  { saving: false, canSave: true, layoutDirection: 'TB', jsonPanelOpen: false },
)

defineEmits<{
  (e: 'autoLayout'): void
  (e: 'validate'): void
  (e: 'save'): void
  (e: 'exportMermaid'): void
  (e: 'openQuickPalette'): void
  (e: 'openTemplateLibrary'): void
  (e: 'toggleLayoutDirection'): void
  (e: 'toggleJson'): void
}>()
</script>

<template>
  <div class="designer-toolbar" role="toolbar" :aria-label="t('workflowDesignerSpike.toolbarAriaLabel')">
    <el-button-group>
      <el-button :disabled="!store.canUndo" @click="store.undo()">
        {{ t('workflowDesignerSpike.actionUndo') }}
      </el-button>
      <el-button :disabled="!store.canRedo" @click="store.redo()">
        {{ t('workflowDesignerSpike.actionRedo') }}
      </el-button>
    </el-button-group>
    <el-button @click="$emit('autoLayout')">
      {{ t('workflowDesignerSpike.actionAutoLayout') }}
    </el-button>
    <el-button @click="$emit('toggleLayoutDirection')">
      {{ t('workflowDesignerPolish.actionLayoutDirection', { dir: layoutDirection }) }}
    </el-button>
    <el-button @click="$emit('openQuickPalette')">
      {{ t('workflowDesignerPolish.actionQuickPalette') }}
    </el-button>
    <el-button @click="$emit('openTemplateLibrary')">
      {{ t('workflowDesignerPolish.actionTemplates') }}
    </el-button>
    <el-button @click="$emit('validate')">
      {{ t('workflowDesignerMvp.actionValidate') }}
    </el-button>
    <el-button type="primary" :loading="saving" :disabled="!canSave" @click="$emit('save')">
      {{ t('workflowDesignerSpike.actionSave') }}
    </el-button>
    <el-button @click="$emit('exportMermaid')">
      {{ t('workflowDesignerSpike.actionMermaid') }}
    </el-button>
    <el-button
      class="designer-toolbar__json-btn"
      :aria-pressed="jsonPanelOpen"
      @click="$emit('toggleJson')"
    >
      {{ t('workflowDesignerJson.toolbarButton') }}
    </el-button>
    <el-tag v-if="store.dirty" type="warning" size="small">
      {{ t('workflowDesignerSpike.dirtyTag') }}
    </el-tag>
  </div>
</template>

<style scoped>
.designer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border-base, #dcdfe6);
  background: var(--color-bg-overlay, #fff);
}
</style>
