<template>
  <span class="copyable-text" @click="copy">
    <span class="copyable-text__value"
      ><slot>{{ text }}</slot></span
    >
    <el-icon class="copyable-text__icon"><DocumentCopy /></el-icon>
  </span>
</template>

<script setup lang="ts">
  import { DocumentCopy } from '@element-plus/icons-vue'
  import { useCopy } from '@/composables/useCopy'

  const props = defineProps<{
    text: string
  }>()

  // 走统一 useCopy:Clipboard API 被拒(非安全上下文/无手势)时回退 execCommand,
  // 不再抛未捕获 writeText 错、不再"点了没反应"。
  const { copy: copyText } = useCopy()
  function copy() {
    void copyText(props.text)
  }
</script>

<style scoped>
  .copyable-text {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    max-width: 100%;
  }

  .copyable-text__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .copyable-text__icon {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .copyable-text:hover .copyable-text__icon {
    opacity: 1;
    color: var(--el-color-primary);
  }
</style>
