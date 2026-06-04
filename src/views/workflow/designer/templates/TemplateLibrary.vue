<script setup lang="ts">
/**
 * 模板库(Polish 阶段)。
 *
 * - 4 个内置模板(templates.ts 定义),纯前端不接 BE
 * - 用户选中后替换当前画布;若 dirty 弹 confirm(避免误覆盖)
 * - 不调任何 BE API
 */
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import { useDesignerStore } from '../store/useDesignerStore'
import { definitionToGraph } from '../codec/definitionToGraph'
import { BUILTIN_TEMPLATES, type DesignerTemplate } from './templates'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'applied', key: string): void
}>()

const { t } = useI18n()
const store = useDesignerStore()

function close() {
  emit('update:visible', false)
}

async function apply(tpl: DesignerTemplate) {
  if (store.dirty) {
    try {
      await ElMessageBox.confirm(
        t('workflowDesignerPolish.templateOverwriteConfirm'),
        t('workflowDesignerPolish.templateOverwriteTitle'),
        { type: 'warning' },
      )
    } catch {
      return
    }
  }
  store.reset(definitionToGraph(tpl.definition))
  emit('applied', tpl.key)
  close()
}

defineExpose({ templates: BUILTIN_TEMPLATES, __applyForTest: apply })
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    :title="t('workflowDesignerPolish.templateLibraryTitle')"
    width="640px"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    @close="close"
  >
    <div class="template-library">
      <div
        v-for="tpl in BUILTIN_TEMPLATES"
        :key="tpl.key"
        class="template-library__card"
        role="button"
        tabindex="0"
        :aria-label="t(tpl.labelKey)"
        @click="apply(tpl)"
        @keydown.enter="apply(tpl)"
      >
        <div class="template-library__card-title">{{ t(tpl.labelKey) }}</div>
        <div class="template-library__card-desc">{{ t(tpl.descKey) }}</div>
        <div class="template-library__card-stats">
          {{ t('workflowDesignerPolish.templateStats', {
            nodes: tpl.definition.nodes.length,
            edges: tpl.definition.edges.length,
          }) }}
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.template-library {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.template-library__card {
  border: 1px solid var(--color-border-base, #dcdfe6);
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.template-library__card:hover {
  border-color: var(--color-primary, #409eff);
  background: var(--color-info-light, #ecf5ff);
}
.template-library__card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #303133);
  margin-bottom: 8px;
}
.template-library__card-desc {
  font-size: 12px;
  color: var(--color-text-secondary, #606266);
  margin-bottom: 12px;
  min-height: 32px;
}
.template-library__card-stats {
  font-size: 11px;
  color: var(--color-text-secondary, #909399);
  font-family: monospace;
}
</style>
