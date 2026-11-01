<template>
  <div
    v-if="attentionItems.length"
    class="execution-attention"
    role="group"
    :aria-label="t('workflowProgress.attentionTitle')"
  >
    <span class="execution-attention__title">{{ t('workflowProgress.attentionTitle') }}</span>
    <el-button
      v-for="item in attentionItems"
      :key="item.code"
      size="small"
      plain
      :aria-pressed="item.code === selected"
      @click="emit('select', item.code)"
    >
      {{ item.name }} · {{ item.stateLabel }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  const props = defineProps<{
    items: { code: string; name: string; state: string; stateLabel: string }[]
    selected: string | null
  }>()
  const emit = defineEmits<{ select: [code: string] }>()
  const { t } = useI18n()
  const states = new Set(['FAILED', 'PARTIAL_FAILED', 'WAITING', 'WAITING_DEPENDENCY'])
  const attentionItems = computed(() =>
    props.items.filter((item) => states.has(item.state.toUpperCase())),
  )
</script>

<style scoped>
  .execution-attention {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    margin-block: var(--space-sm);
  }
  .execution-attention__title {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-right: var(--space-xs);
  }
  .execution-attention :deep(.el-button + .el-button) {
    margin-left: 0;
  }
  .execution-attention :deep(.el-button) {
    max-width: 100%;
    height: auto;
    min-height: 24px;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
  }
  .execution-attention :deep(.el-button[aria-pressed='true']) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
</style>
