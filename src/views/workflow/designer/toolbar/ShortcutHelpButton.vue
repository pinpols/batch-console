<template>
  <el-button :icon="QuestionFilled" text @click="visible = true">
    {{ t('workflowDesignerShortcuts.button') }}
  </el-button>

  <el-dialog
    v-model="visible"
    :title="t('workflowDesignerShortcuts.title')"
    width="420px"
    append-to-body
  >
    <ul class="shortcut-list">
      <li v-for="s in shortcuts" :key="s.key" class="shortcut-list__row">
        <kbd class="shortcut-list__key">{{ s.key }}</kbd>
        <span class="shortcut-list__desc">{{ t(s.descKey) }}</span>
      </li>
    </ul>
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CircleHelp as QuestionFilled } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  const visible = ref(false)

  // 与 DagCanvas / WorkflowDesigner 的 keydown 实现一一对应(改键位时同步此表)
  const shortcuts: Array<{ key: string; descKey: string }> = [
    { key: 'Ctrl/⌘ + K', descKey: 'workflowDesignerShortcuts.quickPalette' },
    { key: 'Ctrl/⌘ + S', descKey: 'workflowDesignerShortcuts.save' },
    { key: 'Ctrl/⌘ + A', descKey: 'workflowDesignerShortcuts.selectAll' },
    { key: 'Ctrl/⌘ + D', descKey: 'workflowDesignerShortcuts.duplicate' },
    { key: 'Ctrl/⌘ + Z', descKey: 'workflowDesignerShortcuts.undo' },
    { key: 'Ctrl/⌘ + Y', descKey: 'workflowDesignerShortcuts.redo' },
    { key: 'Delete / Backspace', descKey: 'workflowDesignerShortcuts.delete' },
  ]
</script>

<style scoped>
  .shortcut-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 8px);
  }
  .shortcut-list__row {
    display: flex;
    align-items: center;
    gap: var(--space-md, 16px);
  }
  .shortcut-list__key {
    flex: 0 0 150px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
    font-size: 12px;
    padding: 2px 8px;
    background: var(--color-bg-subtle, #f5f7fa);
    border: 1px solid var(--color-border-light, #ebeef5);
    border-radius: var(--radius-content, 6px);
    text-align: center;
  }
  .shortcut-list__desc {
    font-size: 13px;
    color: var(--color-text-primary, #303133);
  }
</style>
