<template>
  <el-select
    :model-value="picked"
    filterable
    clearable
    :placeholder="t('workflowDesignerSearch.placeholder')"
    :no-match-text="t('workflowDesignerSearch.noMatch')"
    :no-data-text="t('workflowDesignerSearch.noData')"
    class="node-search"
    size="default"
    @change="onChange"
    @clear="clearSelection"
  >
    <el-option v-for="n in options" :key="n.id" :label="n.label" :value="n.id">
      <span class="node-search__type">{{ n.nodeType }}</span>
      <span class="node-search__label">{{ n.label }}</span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'

  const { t } = useI18n({ useScope: 'global' })
  const store = useDesignerStore()
  const picked = computed(() => {
    const selected = Array.from(store.selectedIds)
    return selected.length === 1 && store.nodes.some((node) => node.id === selected[0])
      ? selected[0]
      : ''
  })

  const emit = defineEmits<{ (e: 'focus', nodeId: string): void }>()

  // 按 nodeName / nodeCode 模糊搜(el-select filterable 用 label 匹配),大图快速定位节点
  const options = computed(() =>
    store.nodes.map((n) => ({
      id: n.id,
      nodeType: n.nodeType,
      label: n.nodeName ? `${n.nodeName} (${n.nodeCode})` : n.nodeCode,
    })),
  )

  function onChange(id: string | null) {
    if (id) emit('focus', id)
  }

  function clearSelection() {
    store.setSelection([])
  }
</script>

<style scoped>
  .node-search {
    width: 200px;
  }
  .node-search__type {
    color: var(--color-text-tertiary, #909399);
    font-size: 11px;
    margin-right: 8px;
  }
  .node-search__label {
    color: var(--color-text-primary, #303133);
  }
</style>
