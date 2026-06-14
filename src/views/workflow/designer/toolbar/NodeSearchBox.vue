<template>
  <el-select
    v-model="picked"
    filterable
    clearable
    :placeholder="t('workflowDesignerSearch.placeholder')"
    :no-match-text="t('workflowDesignerSearch.noMatch')"
    :no-data-text="t('workflowDesignerSearch.noData')"
    class="node-search"
    size="default"
    @change="onChange"
  >
    <el-option
      v-for="n in options"
      :key="n.id"
      :label="n.label"
      :value="n.id"
    >
      <span class="node-search__type">{{ n.nodeType }}</span>
      <span class="node-search__label">{{ n.label }}</span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'

  const { t } = useI18n({ useScope: 'global' })
  const store = useDesignerStore()
  const picked = ref<string>('')

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
    // 选完即清空,保持搜索框是"动作"而非"持久选择",避免与画布选中态混淆
    picked.value = ''
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
