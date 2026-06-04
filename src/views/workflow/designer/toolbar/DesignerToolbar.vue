<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'

const { t } = useI18n()
const store = useDesignerStore()

defineEmits<{
  (e: 'autoLayout'): void
  (e: 'save'): void
  (e: 'exportMermaid'): void
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
    <el-button type="primary" @click="$emit('save')">
      {{ t('workflowDesignerSpike.actionSave') }}
    </el-button>
    <el-button @click="$emit('exportMermaid')">
      {{ t('workflowDesignerSpike.actionMermaid') }}
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
