<script setup lang="ts">
  /**
   * 模板库(Polish 阶段)。
   *
   * - 4 个内置模板(templates.ts 定义),纯前端不接 BE
   * - 用户选中后替换当前画布;若 dirty 弹 confirm(避免误覆盖)
   * - 不调任何 BE API
   */
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
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
    // 只读模式 / 未持有编辑锁:禁止套模板
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    if (store.dirty) {
      try {
        await confirmDanger({
          verb: t('workflowDesignerPolish.templateOverwriteTitle'),
          target: '',
          consequence: t('workflowDesignerPolish.templateOverwriteConfirm'),
          irreversible: true,
        })
      } catch {
        return
      }
    }
    // 套模板 = 加载新内容,必须标脏(reset 会把 dirty 置 false,这里补回)
    store.reset(definitionToGraph(tpl.definition))
    store.markDirty()
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
          {{
            t('workflowDesignerPolish.templateStats', {
              nodes: tpl.definition.nodes.length,
              edges: tpl.definition.edges.length,
            })
          }}
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
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .template-library__card:hover {
    border-color: var(--color-primary, #409eff);
    background: var(--el-color-primary-light-9);
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
